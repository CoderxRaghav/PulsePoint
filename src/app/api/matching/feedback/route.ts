import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  authenticatedTeamUid,
  isRecord,
  readTeamJson,
  teamDatabaseError,
  teamJson,
} from "@/lib/team-server";
import { MATCH_ALGORITHM_VERSION } from "@/lib/matching";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(["dismissed", "requested", "accepted", "rejected"]);

/**
 * POST /api/matching/feedback
 * Leader records the outcome of a ranked suggestion. Server-only table (RLS, no client policies).
 * Used for rules-v1 evaluation; never used to silently demote or block anyone.
 */
export async function POST(request: NextRequest) {
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Matching:feedback] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  if (!isRecord(parsed.value) || Object.keys(parsed.value).some((key) => !["teamId", "candidateUid", "outcome"].includes(key))) {
    return teamJson({ error: "Invalid feedback." }, 400);
  }
  const { teamId, candidateUid, outcome } = parsed.value;
  if (typeof teamId !== "string" || !UUID_PATTERN.test(teamId) ||
      typeof candidateUid !== "string" || !candidateUid.trim() || candidateUid.length > 128 ||
      typeof outcome !== "string" || !OUTCOMES.has(outcome)) {
    return teamJson({ error: "Invalid feedback." }, 400);
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: team, error: teamError } = await supabase.from("teams")
      .select("id,leader_uid")
      .eq("id", teamId)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team) return teamJson({ error: "Team not found." }, 404);
    if (team.leader_uid !== uid) {
      return teamJson({ error: "Only the team leader can record suggestion feedback." }, 403);
    }

    const { error } = await supabase.from("match_feedback").insert({
      team_id: teamId,
      candidate_uid: candidateUid,
      from_uid: uid,
      outcome,
      algorithm_version: MATCH_ALGORITHM_VERSION,
    });
    if (error) throw error;
    return teamJson({ success: true });
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Matching:feedback] Feedback insert failed:", error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
