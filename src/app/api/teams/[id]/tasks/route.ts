import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { authenticatedTeamUid, readTeamJson, teamJson } from "@/lib/team-server";
import {
  TASK_SELECT,
  assigneeNames,
  resolveTaskActor,
  sortTasks,
  taskDatabaseError,
  toTeamTask,
} from "@/lib/task-server";
import { validateTaskCreate } from "@/lib/task-validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/teams/[id]/tasks — team members (and leaders) only; read-only even for archived teams. */
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
    console.error("[API:Teams:tasks] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  try {
    const supabase = getSupabaseAdminClient();
    const actor = await resolveTaskActor(supabase, id, uid, { allowArchived: true });
    if (actor.kind !== "ok") return teamJson({ error: actor.error }, actor.status);

    const { data: rows, error } = await supabase.from("team_tasks")
      .select(TASK_SELECT)
      .eq("team_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const tasks = (rows || []) as unknown as Array<Record<string, unknown>>;
    const names = await assigneeNames(
      supabase,
      Array.from(new Set(tasks.map((r) => String(r.assignee_uid ?? "")).filter(Boolean))),
    );
    const result = sortTasks(
      tasks.map((row) => toTeamTask(row, row.assignee_uid ? names.get(String(row.assignee_uid)) ?? null : null)),
    );

    return teamJson({ tasks: result, can_edit: !actor.team.archived_at });
  } catch (error) {
    console.error("[API:Teams:tasks] Task query failed:", error);
    const mapped = taskDatabaseError(error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}

/** POST /api/teams/[id]/tasks — team members only; assignee must be a current member of this team. */
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
    console.error("[API:Teams:tasks] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  const payload = validateTaskCreate(parsed.value);
  if (!payload) return teamJson({ error: "Invalid task." }, 400);

  try {
    const supabase = getSupabaseAdminClient();
    const actor = await resolveTaskActor(supabase, id, uid);
    if (actor.kind !== "ok") return teamJson({ error: actor.error }, actor.status);
    if (actor.role !== "leader") {
      return teamJson({ error: "Only the team leader can create tasks for this team." }, 403);
    }
    if (payload.assigneeUid && !actor.memberUids.includes(payload.assigneeUid)) {
      return teamJson({ error: "The assignee must be a current team member." }, 400);
    }

    const { data, error } = await supabase.from("team_tasks")
      .insert({
        team_id: id,
        title: payload.title,
        details: payload.details,
        assignee_uid: payload.assigneeUid,
        due_date: payload.dueDate,
        created_by: uid,
      })
      .select(TASK_SELECT)
      .single();
    if (error) throw error;

    const names = await assigneeNames(supabase, payload.assigneeUid ? [payload.assigneeUid] : []);
    return teamJson(
      { task: toTeamTask(data as unknown as Record<string, unknown>, payload.assigneeUid ? names.get(payload.assigneeUid) ?? null : null) },
      201,
    );
  } catch (error) {
    console.error("[API:Teams:tasks] Task creation failed:", error);
    const mapped = taskDatabaseError(error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
