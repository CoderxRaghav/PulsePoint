import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { profileDetails } from "@/lib/team-data";
import { isTeamTaskStatus } from "@/lib/task-validation";
import type { TeamTask, TeamTaskStatus } from "@/lib/team-types";
import { TASK_STATUS_ORDER } from "@/lib/task-validation";

const TASK_SELECT = "id,team_id,title,details,assignee_uid,status,due_date,created_by,created_at,updated_at";
export { TASK_SELECT };

export function toTeamTask(row: Record<string, unknown>, assigneeName: string | null): TeamTask {
  return {
    id: String(row.id),
    team_id: String(row.team_id),
    title: typeof row.title === "string" ? row.title : "",
    details: typeof row.details === "string" ? row.details : "",
    assignee_uid: typeof row.assignee_uid === "string" ? row.assignee_uid : null,
    assignee_name: assigneeName,
    status: isTeamTaskStatus(row.status) ? row.status : "todo",
    due_date: typeof row.due_date === "string" ? row.due_date : null,
    created_by: typeof row.created_by === "string" ? row.created_by : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export async function assigneeNames(
  supabase: SupabaseClient,
  uids: string[],
): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map();
  const { data: profiles, error } = await supabase.from("profiles").select("uid,profile").in("uid", uids);
  if (error) throw error;
  return new Map((profiles || []).map((row) => [String(row.uid), profileDetails(row.profile).fullName]));
}

export function sortTasks(tasks: TeamTask[]): TeamTask[] {
  return [...tasks].sort((a, b) => TASK_STATUS_ORDER[a.status as TeamTaskStatus] - TASK_STATUS_ORDER[b.status as TeamTaskStatus]);
}

export type TaskActor =
  | {
      kind: "ok";
      role: "leader" | "member";
      team: { id: string; leader_uid: string; archived_at: string | null; recruitment_status: string };
      memberUids: string[];
    }
  | { kind: "error" | "forbidden"; status: number; error: string };

/**
 * Loads the team and verifies the caller is a member (or leader).
 * `allowArchived` permits read access to archived teams; writes must pass false.
 */
export async function resolveTaskActor(
  supabase: SupabaseClient,
  teamId: string,
  uid: string,
  { allowArchived = false } = {},
): Promise<TaskActor> {
  const { data: team, error } = await supabase.from("teams")
    .select("id,leader_uid,archived_at,recruitment_status")
    .eq("id", teamId)
    .maybeSingle();
  if (error) return { kind: "error", status: 503, error: "The team service is temporarily unavailable." };
  if (!team) return { kind: "error", status: 404, error: "Team not found." };

  const { data: memberRows, error: membersError } = await supabase.from("team_members")
    .select("user_uid")
    .eq("team_id", teamId);
  if (membersError) return { kind: "error", status: 503, error: "The team service is temporarily unavailable." };

  const memberUids = (memberRows || []).map((row) => String(row.user_uid));
  const isLeader = team.leader_uid === uid;
  const isMember = isLeader || memberUids.includes(uid);
  if (!isMember) {
    return { kind: "forbidden", status: 403, error: "Only team members can access the team workspace." };
  }
  if (team.archived_at && !allowArchived) {
    return { kind: "forbidden", status: 409, error: "This team is archived; its tasks can no longer be changed." };
  }
  return {
    kind: "ok",
    role: isLeader ? "leader" : "member",
    team: { id: team.id, leader_uid: team.leader_uid, archived_at: team.archived_at, recruitment_status: team.recruitment_status },
    memberUids,
  };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function taskDatabaseError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "PGRST205") {
    return {
      error: "Database setup required: the team_tasks table has not been created in Supabase yet. Please apply supabase/migrations/20261116000000_create_team_tasks.sql in the Supabase SQL editor.",
      status: 503,
    };
  }
  if (code === "23503" || code === "23514" || code === "22023") {
    return { error: "The submitted task information is invalid.", status: 400 };
  }
  return { error: "The task service is temporarily unavailable. Please try again.", status: 503 };
}
