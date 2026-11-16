/**
 * Pure event-phase derivation for hackathons. No server-only imports — safe to
 * use from route handlers, server components, and client components.
 */

export type HackathonPhase =
  | "upcoming"
  | "registration_open"
  | "registration_closed"
  | "completed"
  | "unknown";

export interface PhaseInput {
  registration_deadline?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/**
 * Single-word phase for badges/filters. Precedence:
 *   completed (end passed) > registration_closed (deadline passed) >
 *   registration_open (deadline in the future, or none) >
 *   upcoming (no deadline, start in the future) > unknown.
 * Data that does not exist is never fabricated — missing dates yield
 * "registration_open" only when a future deadline exists, otherwise "unknown".
 */
export function getHackathonPhase(
  input: PhaseInput,
  now: Date = new Date()
): HackathonPhase {
  const nowMs = now.getTime();
  const end = input.end_date ? Date.parse(input.end_date) : NaN;
  if (!Number.isNaN(end) && end < nowMs) return "completed";

  const deadline = input.registration_deadline ? Date.parse(input.registration_deadline) : NaN;
  if (!Number.isNaN(deadline) && deadline < nowMs) return "registration_closed";
  if (!Number.isNaN(deadline)) return "registration_open";

  const start = input.start_date ? Date.parse(input.start_date) : NaN;
  if (!Number.isNaN(start) && start > nowMs) return "upcoming";

  return "unknown";
}

/**
 * True when the registration deadline is known and has passed. Used to hide
 * past-deadline events by default; expired rows are never deleted, just hidden.
 */
export function isRegistrationPast(
  input: PhaseInput,
  now: Date = new Date()
): boolean {
  const deadline = input.registration_deadline ? Date.parse(input.registration_deadline) : NaN;
  return !Number.isNaN(deadline) && deadline < now.getTime();
}

export const PHASE_BADGE: Record<HackathonPhase, { label: string; className: string }> = {
  upcoming: {
    label: "Upcoming",
    className: "bg-violet-400/15 text-violet-300 border-violet-400/30",
  },
  registration_open: {
    label: "Registration open",
    className: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  },
  registration_closed: {
    label: "Registration closed",
    className: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  },
  completed: {
    label: "Completed",
    className: "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/25",
  },
  unknown: {
    label: "Dates not listed",
    className: "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/25",
  },
};
