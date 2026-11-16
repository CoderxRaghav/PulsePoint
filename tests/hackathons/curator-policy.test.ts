import { describe, expect, it } from "vitest";
import { parseCuratorUids, isHackathonCurator } from "@/lib/hackathon-curator-policy";

describe("parseCuratorUids", () => {
  it("parses a comma/newline-separated allowlist", () => {
    expect([...parseCuratorUids("uid-a, uid-b\nuid-c")]).toEqual(["uid-a", "uid-b", "uid-c"]);
  });

  it("trims whitespace and drops empty entries", () => {
    expect([...parseCuratorUids("  uid-a ,, uid-b , ,")]).toEqual(["uid-a", "uid-b"]);
  });

  it("rejects entries with embedded whitespace", () => {
    expect(parseCuratorUids("uid a,uid-b").has("uid a")).toBe(false);
    expect(parseCuratorUids("uid a,uid-b").has("uid-b")).toBe(true);
  });

  it("returns an empty (deny-all) set for missing or empty env", () => {
    expect(parseCuratorUids(undefined).size).toBe(0);
    expect(parseCuratorUids(null).size).toBe(0);
    expect(parseCuratorUids("").size).toBe(0);
    expect(parseCuratorUids("   ").size).toBe(0);
  });

  it("drops absurdly long entries", () => {
    const huge = "x".repeat(200);
    expect(parseCuratorUids(huge).size).toBe(0);
  });
});

describe("isHackathonCurator", () => {
  const curators = parseCuratorUids("uid-curator");

  it("allows only the allowlisted UID", () => {
    expect(isHackathonCurator("uid-curator", curators)).toBe(true);
    expect(isHackathonCurator("uid-student", curators)).toBe(false);
    expect(isHackathonCurator("", curators)).toBe(false);
    expect(isHackathonCurator(null, curators)).toBe(false);
    expect(isHackathonCurator(undefined, curators)).toBe(false);
  });

  it("denies everyone when the allowlist is empty", () => {
    expect(isHackathonCurator("uid-curator", new Set())).toBe(false);
  });
});
