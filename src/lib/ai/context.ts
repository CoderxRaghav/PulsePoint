import "server-only";

/**
 * Caller-scoped context assembly for the assistant.
 *
 * Only rows the verified caller can already read under the app's existing
 * rules are included:
 *   - the caller's own profile (a minimal, non-identifying subset),
 *   - teams the caller belongs to (membership-verified),
 *   - projects belonging to those member teams,
 *   - minimized tasks for at most 3 of those teams,
 *   - the caller's own saved hackathons (bookmarked, verified catalog rows
 *     only — archived bookmarks stay visible, mirroring the catalog's
 *     bookmark-survives-archival behaviour).
 *
 * A server-generated "Today (UTC)" anchor is included so stored catalog
 * statuses and deadlines cannot be read as current reality; the date is
 * never derived from user input.
 *
 * Everything else (other users, other members' identities,
 * audit logs, credentials, emails, raw UIDs, curator data, registration URLs,
 * unbookmarked catalog events) is excluded by construction — the queries
 * below are always filtered by the verified uid or by membership-derived
 * team ids. Client-supplied ids are never accepted.
 *
 * The context is compact by design: the Groq free tier allows ~8K tokens per
 * minute shared across the organization. MAX_CONTEXT_CHARS is a hard ceiling
 * on the COMPLETE serialized context — Server context (Today anchor),
 * profile, headings, delimiters, separators — enforced by one shared
 * pushSection() budget that truncates list lines, never by raising field
 * caps.
 *
 * Failure model: team-dependent categories are dropped individually when
 * their query fails; if the membership lookup itself fails, projects and
 * tasks (and teams) are dropped entirely while the caller's own profile and
 * saved bookmarks remain. A teams-table read failure behaves the same —
 * team-dependent sections degrade away without discarding the profile or
 * saved bookmarks. Any failure of the profile read degrades to
 * `null` — the caller gets general assistance only. Raw errors are logged
 * with no contents and never returned to the client.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isTeamTaskStatus, isValidDueDate } from "@/lib/task-validation";
import { isRecord } from "@/lib/team-server";

export interface CallerContext {
  text: string;
}

const MAX_SKILLS = 12;
const MAX_ROLES = 8;
const MAX_INTERESTS = 10;
const MAX_TEAMS = 5;
const MAX_STRING = 160;

// 7B-1 caps — keep the assembled context ≈ ≤ 650 tokens.
// MAX_CONTEXT_CHARS is a hard ceiling for the COMPLETE serialized context:
// Server context, caller profile, team names, projects, tasks, saved
// hackathons, section headings, newline separators and the gap between
// sections are all accounted for by the single shared pushSection() budget.
const MAX_CONTEXT_CHARS = 2600;
const MAX_PROJECT_NAME = 60;
const MAX_PROJECT_DESC = 120;
const MAX_PROJECT_META = 40;
const MAX_PROJECT_TECH = 8;
const MAX_TECH_CHARS = 30;
const MAX_PROJECT_OBJECTIVES = 4;
const MAX_OBJECTIVE_CHARS = 40;
const MAX_TASKS_OPEN_PER_TEAM = 5;
const MAX_TASKS_DONE_PER_TEAM = 5;
const MAX_TASK_TEAMS = 3;
const MAX_TASK_TITLE = 140;
const MAX_SAVED_HACKATHONS = 5;
const MAX_HACKATHON_TITLE = 80;
const MAX_STATUS_CHARS = 30;

function bounded(value: unknown, max = MAX_STRING): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function stringList(value: unknown, maxItems: number, maxLength = 60): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxLength));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Server-generated current date in YYYY-MM-DD (UTC). Never derived from
 * user input or request data. Used as the as-of anchor so stale stored
 * catalog values cannot be read as current reality.
 */
function serverToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Accepts only a real calendar date in strict YYYY-MM-DD form. */
function isValidDateOnly(value: string): boolean {
  return isValidDueDate(value);
}

function profileLines(raw: unknown): string[] {
  const profile = isRecord(raw) ? raw : {};
  const lines: string[] = [];

  const completed = profile.completed === true;
  lines.push(`Profile complete: ${completed ? "yes" : "no"}`);

  const college = bounded(profile.college);
  const degree = bounded(profile.degree);
  const branch = bounded(profile.branch);
  const academicYear = bounded(profile.academicYear, 40);
  const graduationYear = bounded(profile.graduationYear, 8);
  const headline = bounded(profile.headline);
  const buildGoal = bounded(profile.buildGoal, 300);
  const hoursPerWeek = bounded(profile.hoursPerWeek, 40);
  const duration = bounded(profile.duration, 80);

  const program = [degree, branch].filter(Boolean).join(" in ");
  if (college || program) lines.push(`Studying: ${[college, program].filter(Boolean).join(" — ")}`);
  if (academicYear) lines.push(`Academic year: ${academicYear}`);
  if (graduationYear && /^\d{4}$/.test(graduationYear)) lines.push(`Graduation year: ${graduationYear}`);
  if (headline) lines.push(`Headline: ${headline}`);
  if (hoursPerWeek) lines.push(`Availability: ${hoursPerWeek} per week`);
  if (duration) lines.push(`Preferred collaboration duration: ${duration}`);
  if (buildGoal) lines.push(`Build goal: ${truncate(buildGoal, 300)}`);

  const skills = Array.isArray(profile.skills)
    ? profile.skills.flatMap((skill): string[] => {
        if (typeof skill === "string" && skill.trim()) return [skill.trim().slice(0, 60)];
        if (isRecord(skill) && typeof skill.name === "string" && skill.name.trim()) {
          const level = typeof skill.level === "string" && skill.level ? ` (${skill.level.slice(0, 20)})` : "";
          return [truncate(skill.name.trim(), 60) + level];
        }
        return [];
      }).slice(0, MAX_SKILLS)
    : [];
  if (skills.length) lines.push(`Skills: ${skills.join(", ")}`);

  const roles = stringList(profile.roles, MAX_ROLES);
  if (roles.length) lines.push(`Preferred roles: ${roles.join(", ")}`);

  const interests = stringList(profile.interests, MAX_INTERESTS);
  if (interests.length) lines.push(`Interests: ${interests.join(", ")}`);

  return lines;
}

function teamLines(
  memberships: Array<{ team_id: string; role: string }>,
  teams: Array<Record<string, unknown>>,
  callerUid: string,
): string[] {
  const roleByTeam = new Map(memberships.map((membership) => [membership.team_id, membership.role]));
  const lines: string[] = [];

  for (const team of teams.slice(0, MAX_TEAMS)) {
    const id = typeof team.id === "string" ? team.id : "";
    const name = bounded(team.team_name, 80) ?? "Unnamed team";
    const role = bounded(roleByTeam.get(id), 40) ?? "Member";
    const isLeader = team.leader_uid === callerUid;
    const status = team.recruitment_status === "closed" ? "closed" : "open";
    const memberCount = Number(team.member_count) || 0;
    const positionsOpen = Number(team.positions_open) || 0;
    const archived = typeof team.archived_at === "string" && team.archived_at.length > 0;
    const hackathon = bounded(team.hackathon_name, 80);
    const parts = [
      `Team: ${name}`,
      `your role: ${role}${isLeader ? " (leader)" : ""}`,
      `recruiting: ${status}`,
      `members: ${memberCount}`,
      `positions open: ${positionsOpen}`,
    ];
    if (hackathon) parts.push(`hackathon: ${hackathon}`);
    if (archived) parts.push("archived");
    lines.push(parts.join(" · "));
  }
  return lines;
}

function projectLines(
  projects: Array<Record<string, unknown>>,
  teamNameById: Map<string, string>,
): string[] {
  const lines: string[] = [];
  for (const project of projects) {
    const teamId = typeof project.team_id === "string" ? project.team_id : "";
    const teamName = teamNameById.get(teamId) ?? "Unnamed team";
    const name = bounded(project.project_name, MAX_PROJECT_NAME) ?? "Unnamed project";
    const description = bounded(project.description, MAX_PROJECT_DESC);
    const domain = bounded(project.domain, MAX_PROJECT_META);
    const category = bounded(project.category, MAX_PROJECT_META);
    const stage = bounded(project.development_stage, MAX_PROJECT_META);
    const technologies = stringList(project.technologies, MAX_PROJECT_TECH, MAX_TECH_CHARS);
    const objectives = stringList(project.objectives, MAX_PROJECT_OBJECTIVES, MAX_OBJECTIVE_CHARS);

    const parts = [`${teamName} — ${name}`];
    const meta = [domain, category, stage].filter((part): part is string => Boolean(part)).join(" / ");
    if (meta) parts.push(meta);
    if (description) parts.push(description);
    if (technologies.length) parts.push(`Tech: ${technologies.join(", ")}`);
    if (objectives.length) parts.push(`Goals: ${objectives.join("; ")}`);
    lines.push(`- ${parts.join(" · ")}`);
  }
  return lines;
}

function taskLines(
  tasks: Array<Record<string, unknown>>,
  teamNameById: Map<string, string>,
  callerUid: string,
): string[] {
  const perTeam = new Map<string, Array<Record<string, unknown>>>();
  for (const task of tasks) {
    const teamId = typeof task.team_id === "string" ? task.team_id : "";
    if (!teamId || !teamNameById.has(teamId)) continue; // never leak teams outside the verified set
    const bucket = perTeam.get(teamId) ?? [];
    bucket.push(task);
    perTeam.set(teamId, bucket);
  }

  const lines: string[] = [];
  let teamCount = 0;
  for (const [teamId, teamTasks] of perTeam) {
    if (teamCount >= MAX_TASK_TEAMS) break;
    const open = teamTasks
      .filter((task) => task.status === "todo" || task.status === "in_progress")
      .slice(0, MAX_TASKS_OPEN_PER_TEAM);
    const done = teamTasks
      .filter((task) => task.status === "done")
      .slice(0, MAX_TASKS_DONE_PER_TEAM);
    const picked = [...open, ...done];
    if (!picked.length) continue;
    teamCount += 1;
    lines.push(`${teamNameById.get(teamId) ?? "Unnamed team"}:`);
    for (const task of picked) {
      const title = bounded(task.title, MAX_TASK_TITLE) ?? "Untitled task";
      const status = isTeamTaskStatus(task.status) ? task.status : "todo";
      // Absent, null, empty or whitespace-only assignee is "unassigned";
      // raw UIDs never appear in the output.
      const rawAssignee = typeof task.assignee_uid === "string" ? task.assignee_uid.trim() : "";
      const assignee = !rawAssignee ? "unassigned" : rawAssignee === callerUid ? "you" : "teammate";
      const bits = [status, assignee];
      const dueDateRaw = typeof task.due_date === "string" ? task.due_date.slice(0, 10) : "";
      const dueDate = dueDateRaw && isValidDateOnly(dueDateRaw) ? dueDateRaw : null;
      if (dueDate) bits.push(`due ${dueDate}`);
      lines.push(`- [${bits.join(", ")}] ${title}`);
    }
  }
  return lines;
}

function savedHackathonLines(
  savedRows: Array<Record<string, unknown>>,
  eventsById: Map<string, Record<string, unknown>>,
  today: string,
): string[] {
  const lines: string[] = [];
  for (const saved of savedRows.slice(0, MAX_SAVED_HACKATHONS)) {
    const id = typeof saved.hackathon_id === "string" ? saved.hackathon_id : "";
    const event = id ? eventsById.get(id) : undefined;
    if (!event) continue;
    // Catalog rule: only verified listings are ever shown. Bookmarked archived
    // events stay visible (bookmarks survive archival) — flagged as archived.
    if (event.verified !== true) continue;
    const title = bounded(event.title, MAX_HACKATHON_TITLE) ?? "Untitled event";
    const archived = typeof event.archived_at === "string" && event.archived_at.length > 0;
    // Stored values only, always labelled as stored/unverified — a stale
    // catalog row must never read as current fact.
    const status = bounded(event.registration_status, MAX_STATUS_CHARS) ?? "Unknown";
    const storedStatus = `Stored status: ${status} (unverified)`;
    const deadlineRaw = typeof event.registration_deadline === "string" ? event.registration_deadline.slice(0, 10) : "";
    const deadline = deadlineRaw && isValidDateOnly(deadlineRaw) ? deadlineRaw : null;
    if (archived) {
      lines.push(`- ${title} · Archived (saved before archival)`);
    } else if (deadline) {
      // An elapsed stored deadline means one thing only: it has elapsed. The
      // stored status (possibly a stale "Open") says nothing about current
      // availability, so say so explicitly.
      if (deadline < today) {
        lines.push(`- ${title} · ${storedStatus} · deadline ${deadline} (elapsed — do not treat as open)`);
      } else {
        lines.push(`- ${title} · ${storedStatus} · deadline ${deadline}`);
      }
    } else {
      lines.push(`- ${title} · ${storedStatus}`);
    }
  }
  return lines;
}

/**
 * Builds the compact, caller-scoped context block.
 * Returns null on profile-read failure — callers must then answer without
 * private PulsePoint data (never fabricated). Team-dependent categories
 * degrade individually on failure.
 */
export async function buildCallerContext(uid: string): Promise<CallerContext | null> {
  const supabase = getSupabaseAdminClient();
  // Server-generated as-of anchor (UTC) for stored catalog values. Never
  // derived from user input.
  const today = serverToday();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("profile")
    .eq("uid", uid)
    .maybeSingle();
  if (profileError) {
    // Minimal metadata only — never log row contents or credentials.
    console.error("[assistant] Context assembly failed:", profileError instanceof Error ? profileError.name : "profile-error");
    return null;
  }

  // Membership-derived authorisation for every team-dependent read.
  const { data: memberships, error: membershipsError } = await supabase
    .from("team_members")
    .select("team_id,role")
    .eq("user_uid", uid)
    .order("joined_at", { ascending: false })
    .limit(MAX_TEAMS);
  const membershipFailed = Boolean(membershipsError);
  if (membershipsError) {
    console.error("[assistant] Membership lookup failed; team-dependent context dropped:", membershipsError.code ?? "membership-error");
  }

  const teamIds = membershipFailed
    ? []
    : Array.from(new Set((memberships ?? []).map((membership) => String(membership.team_id))));

  // Teams-table read failure: drop every team-dependent section (teams,
  // projects, tasks) but KEEP the independent profile and saved-bookmark
  // context — an availability blip must not discard unrelated data.
  let teamsFailed = false;
  let teams: Array<Record<string, unknown>> = [];
  if (teamIds.length) {
    try {
      const { data, error: teamsError } = await supabase
        .from("teams")
        .select("id,team_name,hackathon_name,recruitment_status,positions_open,member_count,leader_uid,archived_at")
        .in("id", teamIds);
      if (teamsError) throw teamsError;
      teams = (data ?? []) as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      teamsFailed = true;
      teams = [];
      console.error("[assistant] Teams context skipped:", error instanceof Error ? error.name : "teams-error");
    }
  }

  const teamNameById = new Map<string, string>(
    teams
      .map((team): [string, string] | null => {
        const id = typeof team.id === "string" ? team.id : null;
        return id ? [id, bounded(team.team_name, 80) ?? "Unnamed team"] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null),
  );

  // Projects — member teams only, whitelisted fields, bounded lists.
  let projects: Array<Record<string, unknown>> = [];
  if (teamIds.length && !teamsFailed) {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("team_id,project_name,description,domain,category,development_stage,technologies,objectives")
        .in("team_id", teamIds);
      if (error) throw error;
      projects = ((data ?? []) as unknown as Array<Record<string, unknown>>)
        // Defense in depth: never render a project whose team is not in the
        // verified membership-derived set, whatever the query returned.
        .filter((project) => teamNameById.has(String(project.team_id ?? "")));
    } catch (error) {
      console.error("[assistant] Projects context skipped:", error instanceof Error ? error.name : "projects-error");
      projects = [];
    }
  }

  // Tasks — member teams only, ≤3 teams. Each eligible team gets its OWN
  // bounded queries (≤5 open + ≤5 done) so one team's volume can never
  // starve the other teams out of the context. A final in-memory slice acts
  // as the global safety cap.
  //
  // Ordering (documented): both buckets order by updated_at desc —
  // updated_at is maintained by the set_team_tasks_updated_at trigger and
  // bumps on every row write, so for done tasks it approximates "most
  // recently completed" (no completed_at column exists in the schema), and
  // for open tasks it surfaces the most recently touched work first.
  let tasks: Array<Record<string, unknown>> = [];
  const taskTeamIds = teamIds.slice(0, MAX_TASK_TEAMS);
  if (taskTeamIds.length && !teamsFailed) {
    const perTeam = await Promise.all(
      taskTeamIds.map(async (teamId): Promise<Array<Record<string, unknown>>> => {
        const rows: Array<Record<string, unknown>> = [];
        try {
          const { data, error } = await supabase
            .from("team_tasks")
            .select("team_id,title,status,due_date,assignee_uid")
            .eq("team_id", teamId)
            .in("status", ["todo", "in_progress"])
            .order("updated_at", { ascending: false })
            .limit(MAX_TASKS_OPEN_PER_TEAM);
          if (error) throw error;
          rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
        } catch (error) {
          console.error("[assistant] Open tasks context skipped for one team:", error instanceof Error ? error.name : "tasks-open-error");
        }
        try {
          const { data, error } = await supabase
            .from("team_tasks")
            .select("team_id,title,status,due_date,assignee_uid")
            .eq("team_id", teamId)
            .eq("status", "done")
            .order("updated_at", { ascending: false })
            .limit(MAX_TASKS_DONE_PER_TEAM);
          if (error) throw error;
          rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
        } catch (error) {
          console.error("[assistant] Done tasks context skipped for one team:", error instanceof Error ? error.name : "tasks-done-error");
        }
        return rows;
      }),
    );
    tasks = perTeam.flat().slice(0, MAX_TASK_TEAMS * (MAX_TASKS_OPEN_PER_TEAM + MAX_TASKS_DONE_PER_TEAM));
  }

  // Saved hackathons — caller's own bookmarks only, verified catalog rows.
  let savedRows: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from("saved_hackathons")
      .select("hackathon_id,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(MAX_SAVED_HACKATHONS);
    if (error) throw error;
    savedRows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  } catch (error) {
    console.error("[assistant] Saved hackathons context skipped:", error instanceof Error ? error.name : "saved-error");
    savedRows = [];
  }

  // Mirrors the database LIMIT above — the catalog query must be scoped to
  // at most MAX_SAVED_HACKATHONS bookmark ids, even defense-in-depth.
  const bookmarkedRows = savedRows.slice(0, MAX_SAVED_HACKATHONS);
  let savedEventLines: string[] = [];
  const savedIds = Array.from(
    new Set(bookmarkedRows.map((row) => (typeof row.hackathon_id === "string" ? row.hackathon_id : "")).filter(Boolean)),
  );
  if (savedIds.length) {
    try {
      const { data, error } = await supabase
        .from("hackathons")
        .select("id,title,registration_status,registration_deadline,archived_at,verified")
        .in("id", savedIds);
      if (error) throw error;
      const eventsById = new Map<string, Record<string, unknown>>(
        ((data ?? []) as unknown as Array<Record<string, unknown>>)
          .map((event) => [String(event.id), event]),
      );
      savedEventLines = savedHackathonLines(bookmarkedRows, eventsById, today);
    } catch (error) {
      console.error("[assistant] Saved hackathon details skipped:", error instanceof Error ? error.name : "events-error");
      savedEventLines = [];
    }
  }

  // Assemble sections in priority order under a hard character ceiling that
  // covers the COMPLETE serialized context: Server context anchor, profile,
  // section headings, colons/newlines inside sections, line separators and
  // the blank line between sections. One shared budget mechanism — nothing
  // bypasses it. remaining is clamped at zero so it can never go negative.
  const parts: string[] = [];
  let remaining = MAX_CONTEXT_CHARS;
  const pushSection = (header: string, lines: string[]) => {
    if (!lines.length) return;
    const kept: string[] = [];
    let need = header.length + 2;
    for (const line of lines) {
      if (need + line.length + 1 > remaining) break;
      kept.push(line);
      need += line.length + 1;
    }
    if (!kept.length) return;
    const text = `${header}:\n${kept.join("\n")}`;
    parts.push(text);
    remaining = Math.max(0, remaining - (text.length + 2));
  };

  pushSection("Server context", [`Today: ${today} (server-generated date, not user input)`]);
  pushSection("Caller profile (private to the caller)", profileLines(profileRow?.profile));

  const membershipRows = (memberships ?? []).map((membership) => ({
    team_id: String(membership.team_id),
    role: String(membership.role ?? "Member"),
  }));
  const teamSection = teams.length
    ? teamLines(membershipRows, teams, uid)
    : membershipFailed || teamsFailed
      ? []
      : ["Caller teams: none (not a member of any PulsePoint team yet)"];
  pushSection("Caller teams", teamSection);

  pushSection("Caller projects (own teams only)", projectLines(projects, teamNameById));
  pushSection("Open and recently completed tasks (own teams only)", taskLines(tasks, teamNameById, uid));
  pushSection("Caller saved hackathons", savedEventLines);

  if (!parts.length) return null;
  return { text: parts.join("\n\n") };
}
