import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  authenticatedTeamUid,
  isTeamLogoUrl,
  isRecord,
  readTeamJson,
  teamDatabaseError,
  teamJson,
} from "@/lib/team-server";
import { TEAM_SELECT, toTeamMember, toTeamSummary } from "@/lib/team-data";
import { validateTeamPayload } from "@/lib/team-validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return teamJson({ error: "Team not found." }, 404);

  try {
    const supabase = getSupabaseAdminClient();
    let viewerUid: string | null = null;
    if (request.headers.has("authorization")) {
      try {
        viewerUid = await authenticatedTeamUid(request);
      } catch (error) {
        console.error("[API:Teams:id] Firebase authentication configuration failed:", error);
        return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
      }
    }
    const { data: row, error } = await supabase.from("teams")
      .select(TEAM_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return teamJson({ error: "Team not found." }, 404);
    const teamRow = row as unknown as Record<string, unknown>;

    const { data: memberRows, error: membersError } = await supabase.from("team_members")
      .select("user_uid,role,joined_at")
      .eq("team_id", id)
      .order("joined_at");
    if (membersError) throw membersError;

    const members = (memberRows || []) as unknown as Record<string, unknown>[];
    const leaderUid = typeof teamRow.leader_uid === "string" ? teamRow.leader_uid : "";
    const uids = Array.from(new Set([leaderUid, ...members.map((member) => member.user_uid)].filter(
      (uid): uid is string => typeof uid === "string",
    )));
    const { data: memberProfiles, error: memberProfilesError } = uids.length
      ? await supabase.from("profiles").select("uid,profile").in("uid", uids)
      : { data: [], error: null };
    if (memberProfilesError) throw memberProfilesError;

    const profileByUid = new Map((memberProfiles || []).map((profile) => [profile.uid, profile.profile]));
    const viewerIsLeader = Boolean(viewerUid && viewerUid === leaderUid);
    const viewerIsMember = Boolean(viewerUid && (
      viewerUid === leaderUid || members.some((member) => member.user_uid === viewerUid)
    ));
    const visibleUids = viewerIsLeader
      ? new Set(members.flatMap((member) => typeof member.user_uid === "string" ? [member.user_uid] : []))
      : new Set(viewerIsMember && viewerUid ? [viewerUid] : []);
    const team = toTeamSummary(teamRow, profileByUid.get(leaderUid));
    const teamMembers = members.map((member) =>
      toTeamMember(
        member,
        profileByUid.get(typeof member.user_uid === "string" ? member.user_uid : ""),
        visibleUids,
        viewerIsMember,
      ),
    );
    return teamJson({ team: { ...team, members: teamMembers } });
  } catch (error) {
    console.error("[API:Teams:id] Team details query failed:", error);
    return teamJson({ error: "Team details are temporarily unavailable." }, 503);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return teamJson({ error: "Team not found." }, 404);
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:id] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  const body = parsed.value;

  try {
    const supabase = getSupabaseAdminClient();
    if (isRecord(body) && body.action === "archive" && Object.keys(body).length === 1) {
      const { data, error } = await supabase.from("teams")
        .update({ archived_at: new Date().toISOString(), recruitment_status: "closed", positions_open: 0 })
        .eq("id", id)
        .eq("leader_uid", uid)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return teamJson({ error: "Team not found or you are not its leader." }, 403);
      return teamJson({ success: true, archived: true });
    }

    const validated = validateTeamPayload(body);
    if (!validated) return teamJson({ error: "Invalid team or project information." }, 400);
    if (validated.team.logo_url) {
      if (!isTeamLogoUrl(validated.team.logo_url)) {
        return teamJson({ error: "Team logos must be uploaded to PulsePoint storage." }, 400);
      }
    }

    const { error } = await supabase.rpc("update_team_with_project", {
      p_actor_uid: uid,
      p_team_id: id,
      p_team: validated.team,
      p_project: validated.project,
      p_required_skills: validated.requiredSkills,
    });
    if (error) throw error;
    return teamJson({ success: true });
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Teams:id] Team update failed:", error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return teamJson({ error: "Team not found." }, 404);
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:id] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  try {
    const { data, error } = await getSupabaseAdminClient().from("teams")
      .delete()
      .eq("id", id)
      .eq("leader_uid", uid)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return teamJson({ error: "Team not found or you are not its leader." }, 403);
    return teamJson({ success: true, deleted: true });
  } catch (error) {
    console.error("[API:Teams:id] Team deletion failed:", error);
    return teamJson({ error: "The team could not be deleted. Please try again." }, 503);
  }
}
