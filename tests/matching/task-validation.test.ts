import { describe, expect, it } from "vitest";
import {
  isTeamTaskStatus,
  validateTaskCreate,
  validateTaskPatch,
} from "@/lib/task-validation";

describe("validateTaskCreate", () => {
  it("accepts a valid task with minimal fields", () => {
    expect(validateTaskCreate({ title: "Draft onboarding" })).toEqual({
      title: "Draft onboarding",
      details: "",
      assigneeUid: null,
      dueDate: null,
    });
  });

  it("trims and accepts title + details + assignee + dueDate", () => {
    expect(validateTaskCreate({ title: "  Write spec  ", details: "  week 1  ", assigneeUid: " uid-1 ", dueDate: "2026-12-31" })).toEqual({
      title: "Write spec",
      details: "week 1",
      assigneeUid: "uid-1",
      dueDate: "2026-12-31",
    });
  });

  it("rejects invalid or impossible due dates", () => {
    expect(validateTaskCreate({ title: "ok title", dueDate: "2026-02-30" })).toBeNull();
    expect(validateTaskCreate({ title: "ok title", dueDate: "31-12-2026" })).toBeNull();
    expect(validateTaskCreate({ title: "ok title", dueDate: "2026/12/31" })).toBeNull();
    expect(validateTaskCreate({ title: "ok title", dueDate: "next friday" })).toBeNull();
    expect(validateTaskCreate({ title: "ok title", dueDate: 20260101 as unknown as string })).toBeNull();
  });

  it("rejects missing/short/long titles", () => {
    expect(validateTaskCreate({})).toBeNull();
    expect(validateTaskCreate({ title: "x" })).toBeNull();
    expect(validateTaskCreate({ title: "x".repeat(141) })).toBeNull();
  });

  it("rejects details over 1000 chars", () => {
    expect(validateTaskCreate({ title: "ok title", details: "x".repeat(1001) })).toBeNull();
  });

  it("rejects unknown keys and invalid assignees", () => {
    expect(validateTaskCreate({ title: "ok title", hack: true })).toBeNull();
    expect(validateTaskCreate({ title: "ok title", assigneeUid: 42 })).toBeNull();
    expect(validateTaskCreate({ title: "ok title", assigneeUid: "" })).toBeNull();
  });

  it("dueDate optional; null explicitly unassigns a date", () => {
    expect(validateTaskCreate({ title: "ok title", dueDate: null })).toEqual({
      title: "ok title",
      details: "",
      assigneeUid: null,
      dueDate: null,
    });
  });
});

describe("validateTaskPatch", () => {
  it("accepts each single-field patch", () => {
    expect(validateTaskPatch({ status: "done" })).toEqual({ status: "done" });
    expect(validateTaskPatch({ title: "New title" })).toEqual({ title: "New title" });
    expect(validateTaskPatch({ details: "d" })).toEqual({ details: "d" });
    expect(validateTaskPatch({ assigneeUid: null })).toEqual({ assigneeUid: null });
    expect(validateTaskPatch({ assigneeUid: "uid-9" })).toEqual({ assigneeUid: "uid-9" });
    expect(validateTaskPatch({ dueDate: "2026-12-31" })).toEqual({ dueDate: "2026-12-31" });
    expect(validateTaskPatch({ dueDate: null })).toEqual({ dueDate: null });
  });

  it("rejects invalid due dates", () => {
    expect(validateTaskPatch({ dueDate: "2026-13-01" })).toBeNull();
    expect(validateTaskPatch({ dueDate: "2026-02-29" })).toBeNull();
  });

  it("rejects empty patch, unknown keys, bad status", () => {
    expect(validateTaskPatch({})).toBeNull();
    expect(validateTaskPatch({ nope: true })).toBeNull();
    expect(validateTaskPatch({ status: "in-progress" })).toBeNull();
  });

  it("rejects invalid assignee shapes", () => {
    expect(validateTaskPatch({ assigneeUid: "" })).toBeNull();
    expect(validateTaskPatch({ assigneeUid: 5 })).toBeNull();
  });
});

describe("isTeamTaskStatus", () => {
  it("narrows correctly", () => {
    expect(isTeamTaskStatus("todo")).toBe(true);
    expect(isTeamTaskStatus("in_progress")).toBe(true);
    expect(isTeamTaskStatus("done")).toBe(true);
    expect(isTeamTaskStatus("COMPLETED")).toBe(false);
    expect(isTeamTaskStatus(2)).toBe(false);
  });
});
