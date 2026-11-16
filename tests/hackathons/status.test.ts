import { describe, expect, it } from "vitest";
import {
  getHackathonPhase,
  isRegistrationPast,
  PHASE_BADGE,
} from "@/lib/hackathon-status";

const NOW = new Date("2026-11-16T12:00:00.000Z");
const future = new Date(NOW.getTime() + 10 * 24 * 3600 * 1000).toISOString();
const past = new Date(NOW.getTime() - 10 * 24 * 3600 * 1000).toISOString();
const closingSoon = new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString();

describe("getHackathonPhase", () => {
  it("returns completed when the end date has passed", () => {
    expect(getHackathonPhase({ end_date: past, registration_deadline: past, start_date: past }, NOW)).toBe("completed");
  });

  it("returns registration_closed when only the deadline has passed", () => {
    expect(
      getHackathonPhase({ registration_deadline: past, start_date: future, end_date: future }, NOW)
    ).toBe("registration_closed");
  });

  it("returns registration_open when the deadline is in the future", () => {
    expect(getHackathonPhase({ registration_deadline: closingSoon }, NOW)).toBe("registration_open");
    expect(getHackathonPhase({ registration_deadline: future }, NOW)).toBe("registration_open");
  });

  it("returns upcoming when there is no deadline but the event starts in the future", () => {
    expect(getHackathonPhase({ start_date: future }, NOW)).toBe("upcoming");
  });

  it("returns unknown when no usable dates exist", () => {
    expect(getHackathonPhase({}, NOW)).toBe("unknown");
    expect(getHackathonPhase({ registration_deadline: "not-a-date" }, NOW)).toBe("unknown");
  });

  it("never fabricates a phase from garbage input", () => {
    expect(getHackathonPhase({ end_date: "garbage", start_date: "also garbage" }, NOW)).toBe("unknown");
  });

  it("every phase has a badge label", () => {
    for (const phase of ["upcoming", "registration_open", "registration_closed", "completed", "unknown"] as const) {
      expect(PHASE_BADGE[phase].label.length).toBeGreaterThan(0);
    }
  });
});

describe("isRegistrationPast", () => {
  it("is true only for a known, elapsed deadline", () => {
    expect(isRegistrationPast({ registration_deadline: past }, NOW)).toBe(true);
    expect(isRegistrationPast({ registration_deadline: future }, NOW)).toBe(false);
    expect(isRegistrationPast({}, NOW)).toBe(false);
    expect(isRegistrationPast({ registration_deadline: "garbage" }, NOW)).toBe(false);
  });
});
