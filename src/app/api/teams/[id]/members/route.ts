import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  authenticatedTeamUid,
  isRecord,
  readTeamJson,
  teamDatabaseError,
  teamJson,
} from "@/lib/team-server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    console.error("[API:Teams:members] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  if (!isRecord(parsed.value) || parsed.value.action !== "transfer-leadership" ||
      typeof parsed.value.newLeaderUid !== "string" ||
      parsed.value.newLeaderUid.length < 1 || parsed.value.newLeaderUid.length > 128 ||
      Object.keys(parsed.value).some((key) => !["action", "newLeaderUid"].includes(key))) {
    return teamJson({ error: "Choose a current team member to receive leadership." }, 400);
  }

  try {
    const { error } = await getSupabaseAdminClient().rpc("transfer_team_leadership", {
      p_actor_uid: uid,
      p_team_id: id,
      p_new_leader_uid: parsed.value.newLeaderUid,
    });
    if (error) throw error;
    return teamJson({ success: true });
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Teams:members] Leadership transfer failed:", error);
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
    console.error("[API:Teams:members] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  const userUid = isRecord(parsed.value) && typeof parsed.value.userUid === "string"
    ? parsed.value.userUid
    : uid;
  if (isRecord(parsed.value) && Object.keys(parsed.value).some((key) => key !== "userUid")) {
    return teamJson({ error: "Invalid member action." }, 400);
  }

  try {
    const { data, error } = await getSupabaseAdminClient().rpc("remove_team_member", {
      p_actor_uid: uid,
      p_team_id: id,
      p_user_uid: userUid,
    });
    if (error) throw error;
    return teamJson({ success: true, ...data });
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Teams:members] Member removal failed:", error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
