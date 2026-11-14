import { NextRequest } from "next/server";
import { connection } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { TEAM_SELECT, toTeamSummary } from "@/lib/team-data";
import { authenticatedTeamUid, teamJson } from "@/lib/team-server";
import type { TeamRequest } from "@/lib/team-types";

export async function GET(request: NextRequest) {
  await connection();

  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:mine] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  try {
    const supabase = getSupabaseAdminClient();
    const { data: memberships, error: membershipsError } = await supabase.from("team_members")
      .select("team_id,user_uid,role,joined_at")
      .eq("user_uid", uid)
      .order("joined_at", { ascending: false });
    if (membershipsError) throw membershipsError;

    const teamIds = Array.from(new Set((memberships || []).map((member) => member.team_id)));
    const [{ data: teamRows, error: teamsError }, { data: requests, error: requestsError }] = await Promise.all([
      teamIds.length
        ? supabase.from("teams").select(TEAM_SELECT).in("id", teamIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from("team_join_requests")
        .select("id,team_id,applicant_uid,message,preferred_role,status,created_at,updated_at,team:teams!inner(id,team_name,logo_url,recruitment_status)")
        .eq("applicant_uid", uid)
        .order("created_at", { ascending: false }),
    ]);
    if (teamsError) throw teamsError;
    if (requestsError) throw requestsError;

    const rows = (teamRows || []) as unknown as Record<string, unknown>[];
    const leaderUids = Array.from(new Set(rows.map((row) => row.leader_uid).filter(
      (leaderUid): leaderUid is string => typeof leaderUid === "string",
    )));
    const { data: profiles, error: profilesError } = leaderUids.length
      ? await supabase.from("profiles").select("uid,profile").in("uid", leaderUids)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profileByUid = new Map((profiles || []).map((profile) => [profile.uid, profile.profile]));

    const membershipByTeam = new Map((memberships || []).map((membership) => [membership.team_id, membership]));
    const teamRequests: TeamRequest[] = (requests || []).map((item) => ({
      id: item.id,
      team_id: item.team_id,
      applicant_uid: item.applicant_uid,
      message: item.message,
      preferred_role: item.preferred_role,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      team: Array.isArray(item.team) ? item.team[0] : item.team,
    }));

    const teams = rows.map((row) => {
      const leaderUid = typeof row.leader_uid === "string" ? row.leader_uid : "";
      const team = toTeamSummary(row, profileByUid.get(leaderUid));
      const membership = membershipByTeam.get(team.id);
      return {
        ...team,
        member_role: membership?.role || "Member",
        is_leader: leaderUid === uid,
        pending_requests: 0,
      };
    });

    const leaderTeamIds = teams.filter((team) => team.is_leader).map((team) => team.id);
    if (leaderTeamIds.length) {
      const { data: pendingRequests, error: pendingError } = await supabase.from("team_join_requests")
        .select("team_id")
        .in("team_id", leaderTeamIds)
        .eq("status", "pending");
      if (pendingError) throw pendingError;
      const pendingCount = new Map<string, number>();
      for (const item of pendingRequests || []) {
        pendingCount.set(item.team_id, (pendingCount.get(item.team_id) || 0) + 1);
      }
      for (const team of teams) team.pending_requests = pendingCount.get(team.id) || 0;
    }

    return teamJson({ teams, requests: teamRequests });
  } catch (error) {
    console.error("[API:Teams:mine] Could not load the user's teams:", error);
    return teamJson({ error: "Your teams are temporarily unavailable." }, 503);
  }
}
