"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { teamRequest } from "@/lib/team-client";
import type { TeamMember, TeamTask, TeamTaskStatus } from "@/lib/team-types";

const panelClass = "rounded-2xl border border-charcoal-700 bg-charcoal-900 p-5 sm:p-7";

const COLUMNS: Array<{ status: TeamTaskStatus; label: string; accent: string }> = [
  { status: "todo", label: "To do", accent: "text-warm-white-muted" },
  { status: "in_progress", label: "In progress", accent: "text-amber-500" },
  { status: "done", label: "Done", accent: "text-emerald-500" },
];

function assigneeLabel(member: TeamMember) {
  if (member.user_uid === "") return member.full_name;
  return member.full_name;
}

export function TaskBoard({
  user,
  teamId,
  members,
  isLeader,
  canEdit,
}: {
  user: User;
  teamId: string;
  members: TeamMember[];
  isLeader: boolean;
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<TeamTask[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [assigneeUid, setAssigneeUid] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [filter, setFilter] = useState<TeamTaskStatus | "all">("all");
  const [busy, setBusy] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;
    teamRequest<{ tasks: TeamTask[] }>(user, `/api/teams/${teamId}/tasks`)
      .then((data) => { if (active) setTasks(Array.isArray(data.tasks) ? data.tasks : []); })
      .catch((err: unknown) => { if (active) setLoadError(err instanceof Error ? err.message : "Could not load the task board."); });
    return () => { active = false; };
  }, [user, teamId, retryNonce]);

  const load = () => { setTasks(null); setLoadError(null); setRetryNonce((n) => n + 1); };

  const assignOptions = useMemo(() => members.filter((m) => m.user_uid), [members]);

  const createTask = async () => {
    if (busy) return;
    if (title.trim().length < 2) { setActionError("Give the task a title (at least 2 characters)."); return; }
    setBusy(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = { title: title.trim() };
      if (details.trim()) body.details = details.trim();
      if (assigneeUid) body.assigneeUid = assigneeUid;
      if (dueDate) body.dueDate = dueDate;
      await teamRequest(user, `/api/teams/${teamId}/tasks`, "POST", body);
      setTitle("");
      setDetails("");
      setAssigneeUid("");
      setDueDate("");
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not create the task.");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (task: TeamTask, next: TeamTaskStatus) => {
    if (busy || !canEdit) return;
    setBusy(true);
    setActionError(null);
    try {
      await teamRequest(user, `/api/teams/${teamId}/tasks/${task.id}`, "PATCH", { status: next });
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the task.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (task: TeamTask) => {
    if (busy || !canEdit) return;
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await teamRequest(user, `/api/teams/${teamId}/tasks/${task.id}`, "DELETE");
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete the task.");
    } finally {
      setBusy(false);
    }
  };

  const visible = (tasks ?? []).filter((t) => filter === "all" || t.status === filter);
  const canAdvance = (task: TeamTask) => canEdit && (isLeader || task.assignee_uid === user.uid);
  const canDeleteTask = () => canEdit && isLeader;
  const nextOf = (status: TeamTaskStatus): { next: TeamTaskStatus; label: string } | null => {
    if (status === "todo") return { next: "in_progress", label: "Start" };
    if (status === "in_progress") return { next: "done", label: "Mark done" };
    return { next: "todo", label: "Reopen" };
  };

  return (
    <section className={panelClass} aria-label="Team tasks">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Team workspace</p>
          <h2 className="team-heading mt-2 text-xl font-bold">Tasks</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tasks">
          {(["all", "todo", "in_progress", "done"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === key ? "bg-crimson text-white" : "border border-charcoal-700 text-warm-white-muted hover:text-warm-white"}`}
            >
              {key === "all" ? "All" : COLUMNS.find((c) => c.status === key)?.label}
            </button>
          ))}
        </div>
      </div>

      {canEdit && isLeader && (
        <form className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); void createTask(); }}>
          <label className="min-w-0 flex-1 text-xs text-warm-white-muted">
            New task
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={140}
              required
              placeholder="e.g. Draft the onboarding flow"
              className="mt-1 w-full rounded-xl border border-charcoal-700 bg-space-black px-3.5 py-2.5 text-sm text-warm-white outline-none focus:border-crimson"
            />
          </label>
          <label className="sm:w-40 text-xs text-warm-white-muted">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-charcoal-700 bg-space-black px-3 py-2.5 text-sm text-warm-white outline-none focus:border-crimson"
            />
          </label>
          <label className="sm:w-44 text-xs text-warm-white-muted">
            Assignee
            <select
              value={assigneeUid}
              onChange={(event) => setAssigneeUid(event.target.value)}
              className="mt-1 w-full rounded-xl border border-charcoal-700 bg-space-black px-3 py-2.5 text-sm text-warm-white outline-none focus:border-crimson"
            >
              <option value="">Unassigned</option>
              {assignOptions.map((member) => (
                <option key={member.user_uid} value={member.user_uid}>{assigneeLabel(member)}{member.role === "Team Lead" ? " (Lead)" : ""}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || title.trim().length < 2} className="rounded-xl bg-crimson px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add</button>
        </form>
      )}

      {actionError && <p role="alert" className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">{actionError}</p>}

      {tasks === null && !loadError && (
        <div className="mt-5 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-charcoal-700 bg-space-black/40" />)}
        </div>
      )}

      {loadError && (
        <div className="mt-5">
          <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{loadError}</p>
          <button type="button" onClick={load} className="mt-3 rounded-lg border border-charcoal-700 px-3 py-2 text-sm font-semibold text-warm-white-muted hover:text-warm-white">Try again</button>
        </div>
      )}

      {tasks !== null && !loadError && visible.length === 0 && (
        <p className="mt-5 text-sm leading-6 text-warm-white-muted">
          {(tasks ?? []).length === 0
            ? "No tasks yet — create the first one to coordinate the team."
            : "No tasks in this filter."}
        </p>
      )}

      {tasks !== null && !loadError && visible.length > 0 && (
        <ul className="mt-5 space-y-3">
          {visible.map((task) => {
            const moving = nextOf(task.status);
            return (
              <li key={task.id} className="flex items-start justify-between gap-3 rounded-xl border border-charcoal-700 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${COLUMNS.find((c) => c.status === task.status)?.accent}`}>{task.status.replace("_", " ")}</span>
                    <span className="text-sm font-semibold">{task.title}</span>
                  </div>
                  {task.details && <p className="mt-1 text-xs leading-5 text-warm-white-muted">{task.details}</p>}
                  <p className="mt-1.5 text-[11px] text-warm-white-muted">
                    {task.assignee_name ? <>Assigned to <span className="text-warm-white">{task.assignee_name}</span></> : "Unassigned"}
                    {task.due_date ? <> · Due <span className="text-warm-white">{task.due_date}</span></> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {canAdvance(task) && moving && (
                    <button type="button" disabled={busy} onClick={() => void advance(task, moving.next)} className="rounded-lg border border-charcoal-700 px-2.5 py-1.5 text-[11px] font-semibold text-warm-white-muted transition hover:border-crimson/40 hover:text-warm-white disabled:opacity-50">{moving.label}</button>
                  )}
                  {canDeleteTask() && (
                    <button type="button" disabled={busy} onClick={() => void remove(task)} aria-label={`Delete task ${task.title}`} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-500 transition hover:bg-rose-500/5 disabled:opacity-50">Delete</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
