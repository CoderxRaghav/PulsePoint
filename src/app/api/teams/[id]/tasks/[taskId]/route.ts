import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { authenticatedTeamUid, readTeamJson, teamJson } from "@/lib/team-server";
import {
  TASK_SELECT,
  assigneeNames,
  resolveTaskActor,
  taskDatabaseError,
  toTeamTask,
} from "@/lib/task-server";
import { validateTaskPatch } from "@/lib/task-validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/teams/[id]/tasks/[taskId]
 * Authorization model:
 *  - Leader: full control of every field on any task.
 *  - Member: may update ONLY the status, and ONLY of tasks assigned to them.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(taskId)) return teamJson({ error: "Task not found." }, 404);
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:task] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  const patch = validateTaskPatch(parsed.value);
  if (!patch) return teamJson({ error: "Invalid task update." }, 400);

  try {
    const supabase = getSupabaseAdminClient();
    const actor = await resolveTaskActor(supabase, id, uid);
    if (actor.kind !== "ok") return teamJson({ error: actor.error }, actor.status);

    const { data: row, error } = await supabase.from("team_tasks")
      .select(TASK_SELECT)
      .eq("id", taskId)
      .eq("team_id", id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return teamJson({ error: "Task not found." }, 404);

    const isLeader = actor.role === "leader";
    const isOwnAssignedTask = typeof row.assignee_uid === "string" && row.assignee_uid === uid;

    const touchesNonStatus =
      "title" in patch || "details" in patch || "assigneeUid" in patch || "dueDate" in patch;
    if (touchesNonStatus && !isLeader) {
      return teamJson({ error: "Only the team leader can edit this task." }, 403);
    }
    if ("status" in patch && !isLeader && !isOwnAssignedTask) {
      return teamJson({ error: "Members can update the status only of tasks assigned to them." }, 403);
    }
    if ("assigneeUid" in patch && isLeader && patch.assigneeUid && !actor.memberUids.includes(patch.assigneeUid)) {
      return teamJson({ error: "The assignee must be a current team member." }, 400);
    }

    const update: Record<string, unknown> = {};
    if ("title" in patch) update.title = patch.title;
    if ("details" in patch) update.details = patch.details;
    if ("status" in patch) update.status = patch.status;
    if ("dueDate" in patch) update.due_date = patch.dueDate;
    if ("assigneeUid" in patch) update.assignee_uid = patch.assigneeUid;

    const { data: updated, error: updateError } = await supabase.from("team_tasks")
      .update(update)
      .eq("id", taskId)
      .eq("team_id", id)
      .select(TASK_SELECT)
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return teamJson({ error: "Task not found." }, 404);

    const names = await assigneeNames(supabase, updated.assignee_uid ? [updated.assignee_uid] : []);
    return teamJson({ task: toTeamTask(updated as unknown as Record<string, unknown>, updated.assignee_uid ? names.get(updated.assignee_uid) ?? null : null) });
  } catch (error) {
    console.error("[API:Teams:task] Task update failed:", error);
    const mapped = taskDatabaseError(error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}

/** DELETE /api/teams/[id]/tasks/[taskId] — team leader only. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(taskId)) return teamJson({ error: "Task not found." }, 404);
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:task] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  try {
    const supabase = getSupabaseAdminClient();
    const actor = await resolveTaskActor(supabase, id, uid);
    if (actor.kind !== "ok") return teamJson({ error: actor.error }, actor.status);

    const { data: row, error } = await supabase.from("team_tasks")
      .select("id,created_by")
      .eq("id", taskId)
      .eq("team_id", id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return teamJson({ error: "Task not found." }, 404);

    const isLeader = actor.role === "leader";
    if (!isLeader) {
      return teamJson({ error: "Only the team leader can delete a task." }, 403);
    }

    const { error: deleteError } = await supabase.from("team_tasks")
      .delete()
      .eq("id", taskId)
      .eq("team_id", id);
    if (deleteError) throw deleteError;
    return teamJson({ success: true, deleted: true });
  } catch (error) {
    console.error("[API:Teams:task] Task deletion failed:", error);
    const mapped = taskDatabaseError(error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
