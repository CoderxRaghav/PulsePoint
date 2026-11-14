import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  authenticatedTeamUid,
  isBoundedText,
  isRecord,
  readTeamJson,
  teamDatabaseError,
  teamJson,
} from "@/lib/team-server";
import { profileDetails } from "@/lib/team-data";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return teamJson({ error: "Team not found." }, 404);
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:requests] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  try {
    const supabase = getSupabaseAdminClient();
    const { data: team, error: teamError } = await supabase.from("teams")
      .select("id,leader_uid,archived_at")
      .eq("id", id)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team) return teamJson({ error: "Team not found." }, 404);
    if (team.leader_uid !== uid) return teamJson({ error: "Only the team leader can view join requests." }, 403);

    const { data: requests, error } = await supabase.from("team_join_requests")
      .select("id,team_id,applicant_uid,message,preferred_role,status,created_at,updated_at")
      .eq("team_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const applicantUids = Array.from(new Set((requests || []).map((item) => item.applicant_uid)));
    const { data: profiles, error: profilesError } = applicantUids.length
      ? await supabase.from("profiles").select("uid,profile").in("uid", applicantUids)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profileByUid = new Map((profiles || []).map((profile) => [profile.uid, profile.profile]));
    const result = (requests || []).map((item) => {
      const applicant = profileDetails(profileByUid.get(item.applicant_uid));
      return {
        id: item.id,
        team_id: item.team_id,
        message: item.message,
        preferred_role: item.preferred_role,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        applicant_name: applicant.fullName,
        applicant_photo_url: applicant.photoUrl,
        applicant_college: applicant.college,
        applicant_skills: applicant.skills,
      };
    });
    return teamJson({ requests: result });
  } catch (error) {
    console.error("[API:Teams:requests] Request list query failed:", error);
    return teamJson({ error: "Join requests are temporarily unavailable." }, 503);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return teamJson({ error: "Team not found." }, 404);
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:requests] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  if (!isRecord(parsed.value) ||
      Object.keys(parsed.value).some((key) => !["message", "preferredRole"].includes(key))) {
    return teamJson({ error: "Invalid join request." }, 400);
  }
  const message = parsed.value.message ?? "";
  const preferredRole = parsed.value.preferredRole ?? "Member";
  if (!isBoundedText(message, 0, 1200) || !isBoundedText(preferredRole, 1, 80)) {
    return teamJson({ error: "Add a valid message and preferred role." }, 400);
  }

  try {
    const { data, error } = await getSupabaseAdminClient().rpc("create_team_join_request", {
      p_actor_uid: uid,
      p_team_id: id,
      p_message: message.trim(),
      p_preferred_role: preferredRole.trim(),
    });
    if (error) throw error;
    return teamJson({ requestId: data, status: "pending" }, 201);
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Teams:requests] Request creation failed:", error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
