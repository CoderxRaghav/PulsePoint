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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const { id, requestId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(requestId)) {
    return teamJson({ error: "Join request not found." }, 404);
  }
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:request] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  if (!isRecord(parsed.value) || Object.keys(parsed.value).some((key) => key !== "action")) {
    return teamJson({ error: "Invalid join request action." }, 400);
  }
  const action = parsed.value.action;
  if (action !== "accept" && action !== "reject" && action !== "withdraw") {
    return teamJson({ error: "Choose accept, reject, or withdraw." }, 400);
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: requestRow, error: requestError } = await supabase.from("team_join_requests")
      .select("id,team_id,status")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!requestRow || requestRow.team_id !== id) {
      return teamJson({ error: "Join request not found." }, 404);
    }

    if (action === "accept") {
      const { error } = await supabase.rpc("accept_team_join_request", {
        p_actor_uid: uid,
        p_request_id: requestId,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc("decide_team_join_request", {
        p_actor_uid: uid,
        p_request_id: requestId,
        p_status: action === "reject" ? "rejected" : "withdrawn",
      });
      if (error) throw error;
    }

    const { data: updatedRequest, error: updatedRequestError } = await supabase.from("team_join_requests")
      .select("id,status")
      .eq("id", requestId)
      .maybeSingle();
    if (updatedRequestError) throw updatedRequestError;
    if (!updatedRequest) return teamJson({ error: "Join request not found." }, 404);
    return teamJson({ success: true, status: updatedRequest.status });
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Teams:request] Request update failed:", error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
