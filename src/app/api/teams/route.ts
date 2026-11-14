import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  authenticatedTeamUid,
  isTeamLogoUrl,
  readTeamJson,
  teamDatabaseError,
  teamJson,
} from "@/lib/team-server";
import { TEAM_SELECT, toTeamSummary } from "@/lib/team-data";
import { validateTeamPayload } from "@/lib/team-validation";

const PAGE_SIZE = 24;

function safeSearch(value: string) {
  return value.replace(/[%,()\\]/g, " ").trim().slice(0, 100);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status") || "open";
  const queryText = safeSearch(params.get("query") || "");
  const technology = params.get("technology")?.trim().slice(0, 60) || "";
  const domain = params.get("domain")?.trim().slice(0, 100) || "";
  const college = params.get("college")?.trim().slice(0, 160) || "";
  const minPositions = Math.max(0, Math.min(50, Number(params.get("positions")) || 0));
  const sortBy = params.get("sortBy") === "positions" ? "positions" : "newest";
  const page = Math.max(0, Math.min(500, Number(params.get("page")) || 0));

  if (!["open", "closed", "all"].includes(status)) {
    return teamJson({ error: "Invalid recruitment status filter." }, 400);
  }

  try {
    const supabase = getSupabaseAdminClient();
    let matchingIds: string[] | null = null;
    if (queryText) {
      const [teamMatches, projectMatches] = await Promise.all([
        supabase.from("teams").select("id").is("archived_at", null)
          .or(`team_name.ilike.%${queryText}%,description.ilike.%${queryText}%`),
        supabase.from("projects").select("team_id")
          .or(`project_name.ilike.%${queryText}%,description.ilike.%${queryText}%`),
      ]);
      if (teamMatches.error) throw teamMatches.error;
      if (projectMatches.error) throw projectMatches.error;
      matchingIds = Array.from(new Set([
        ...(teamMatches.data || []).map((row) => row.id),
        ...(projectMatches.data || []).map((row) => row.team_id),
      ]));
      if (!matchingIds.length) return teamJson({ teams: [], total: 0, page, pageSize: PAGE_SIZE });
    }

    let teamQuery = supabase.from("teams")
      .select(TEAM_SELECT, { count: "exact" })
      .is("archived_at", null);

    if (status !== "all") teamQuery = teamQuery.eq("recruitment_status", status);
    if (status === "open") teamQuery = teamQuery.gte("positions_open", minPositions || 1);
    else if (minPositions > 0) teamQuery = teamQuery.gte("positions_open", minPositions);
    if (college) teamQuery = teamQuery.eq("college", college);
    if (technology) teamQuery = teamQuery.contains("project.technologies", [technology]);
    if (domain) teamQuery = teamQuery.eq("project.domain", domain);
    if (matchingIds) teamQuery = teamQuery.in("id", matchingIds);

    const orderedQuery = sortBy === "positions"
      ? teamQuery.order("positions_open", { ascending: false }).order("created_at", { ascending: false })
      : teamQuery.order("created_at", { ascending: false });
    const { data, error, count } = await orderedQuery.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;

    const rows = (data || []) as unknown as Record<string, unknown>[];
    const leaderUids = Array.from(new Set(rows.map((row) => typeof row.leader_uid === "string" ? row.leader_uid : "").filter(Boolean)));
    const { data: profiles, error: profileError } = leaderUids.length
      ? await supabase.from("profiles").select("uid,profile").in("uid", leaderUids)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const profilesByUid = new Map((profiles || []).map((profile) => [profile.uid, profile.profile]));
    const teams = rows.map((row) =>
      toTeamSummary(row, profilesByUid.get(typeof row.leader_uid === "string" ? row.leader_uid : "")),
    );

    return teamJson({ teams, total: count ?? teams.length, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error("[API:Teams] Directory query failed:", error);
    return teamJson({ error: "The team directory is temporarily unavailable." }, 503);
  }
}

export async function POST(request: NextRequest) {
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  const payload = validateTeamPayload(parsed.value);
  if (!payload) return teamJson({ error: "Invalid team or project information." }, 400);

  if (payload.team.logo_url) {
    if (!isTeamLogoUrl(payload.team.logo_url)) {
      return teamJson({ error: "Team logos must be uploaded to PulsePoint storage." }, 400);
    }
  }

  try {
    const { data, error } = await getSupabaseAdminClient().rpc("create_team_with_project", {
      p_leader_uid: uid,
      p_team: payload.team,
      p_project: payload.project,
      p_required_skills: payload.requiredSkills,
    });
    if (error) throw error;
    return teamJson({ teamId: data }, 201);
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Teams] Team creation failed:", error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
