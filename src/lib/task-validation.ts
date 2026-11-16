import type { TeamTaskStatus } from "@/lib/team-types";

export const TASK_STATUS_ORDER: Record<TeamTaskStatus, number> = { todo: 0, in_progress: 1, done: 2 };

export interface ValidatedTaskCreate {
  title: string;
  details: string;
  assigneeUid: string | null;
  dueDate: string | null;
}

export interface ValidatedTaskPatch {
  title?: string;
  details?: string;
  assigneeUid?: string | null;
  status?: TeamTaskStatus;
  dueDate?: string | null;
}

const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDueDate(value: unknown): value is string {
  if (typeof value !== "string" || !DUE_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) return false;
  // Round-trip the UTC calendar day to reject impossible dates like 2026-02-30.
  return parsed.toISOString().slice(0, 10) === value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBoundedText(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === "string" &&
    value.trim().length >= minLength &&
    value.length <= maxLength;
}

export function validateTaskCreate(value: unknown): ValidatedTaskCreate | null {
  if (!isRecord(value) || Object.keys(value).some((k) => !["title", "details", "assigneeUid", "dueDate"].includes(k))) return null;
  if (!isBoundedText(value.title, 2, 140)) return null;
  const details = value.details === undefined ? "" : value.details;
  if (typeof details !== "string" || details.length > 1000) return null;
  const assigneeUid = value.assigneeUid;
  if (assigneeUid !== undefined && assigneeUid !== null) {
    if (typeof assigneeUid !== "string" || assigneeUid.trim().length < 1 || assigneeUid.length > 128) return null;
    return withValidDueDate({ title: value.title.trim(), details: details.trim(), assigneeUid: assigneeUid.trim() }, value.dueDate);
  }
  return withValidDueDate({ title: value.title.trim(), details: details.trim(), assigneeUid: null }, value.dueDate);
}

function withValidDueDate<T extends Omit<ValidatedTaskCreate, "dueDate">>(base: T, dueDate: unknown): ValidatedTaskCreate | null {
  if (dueDate === undefined || dueDate === null) return { ...base, dueDate: null };
  if (!isValidDueDate(dueDate)) return null;
  return { ...base, dueDate };
}

export function validateTaskPatch(value: unknown): ValidatedTaskPatch | null {
  if (!isRecord(value) || Object.keys(value).length === 0 ||
      Object.keys(value).some((k) => !["title", "details", "assigneeUid", "status", "dueDate"].includes(k))) return null;
  const patch: ValidatedTaskPatch = {};
  if ("title" in value) {
    if (!isBoundedText(value.title, 2, 140)) return null;
    patch.title = value.title.trim();
  }
  if ("details" in value) {
    if (typeof value.details !== "string" || value.details.length > 1000) return null;
    patch.details = value.details.trim();
  }
  if ("status" in value) {
    if (value.status !== "todo" && value.status !== "in_progress" && value.status !== "done") return null;
    patch.status = value.status;
  }
  if ("dueDate" in value) {
    if (value.dueDate === null) patch.dueDate = null;
    else if (!isValidDueDate(value.dueDate)) return null;
    else patch.dueDate = value.dueDate;
  }
  if ("assigneeUid" in value) {
    if (value.assigneeUid === null) {
      patch.assigneeUid = null;
    } else if (typeof value.assigneeUid === "string" && value.assigneeUid.trim().length >= 1 && value.assigneeUid.length <= 128) {
      patch.assigneeUid = value.assigneeUid.trim();
    } else return null;
  }
  return patch;
}

export function isTeamTaskStatus(value: unknown): value is TeamTaskStatus {
  return value === "todo" || value === "in_progress" || value === "done";
}
