import { describe, expect, it } from "vitest";
import {
  calculateRegistrationStatus,
  computeSyncHash,
  deduplicateHackathons,
  generateCanonicalSlug,
} from "@/lib/aggregator/deduplication";
import type { NormalizedHackathon } from "@/lib/aggregator/types";

function event(partial: Partial<NormalizedHackathon>): NormalizedHackathon {
  return {
    id: partial.id ?? "test-1",
    slug: partial.slug ?? generateCanonicalSlug(partial.title ?? "Test Event"),
    title: partial.title ?? "Test Event",
    organizer: partial.organizer ?? null,
    source_platform: partial.source_platform ?? "OrganizerFeed",
    source_url: partial.source_url ?? "https://example.org/e",
    apply_url: partial.apply_url ?? "https://example.org/e/register",
    mode: partial.mode ?? null,
    location: partial.location ?? null,
    registration_status: partial.registration_status ?? "Unknown",
    registration_deadline: partial.registration_deadline,
    start_date: partial.start_date,
    end_date: partial.end_date,
    prize_pool: partial.prize_pool ?? null,
    prize_usd: partial.prize_usd ?? null,
    themes: partial.themes ?? [],
    skills: partial.skills ?? [],
    team_size_min: partial.team_size_min ?? null,
    team_size_max: partial.team_size_max ?? null,
    description: partial.description ?? null,
    eligibility: partial.eligibility ?? null,
    featured: partial.featured ?? false,
    verified: partial.verified ?? true,
    sync_hash: partial.sync_hash ?? "hash",
  };
}

describe("calculateRegistrationStatus", () => {
  it("marks elapsed deadlines Closed and near deadlines Closing Soon", () => {
    const past = new Date(Date.now() - 3600e3).toISOString();
    const soon = new Date(Date.now() + 24 * 3600e3).toISOString();
    const later = new Date(Date.now() + 30 * 24 * 3600e3).toISOString();
    expect(calculateRegistrationStatus(past, "Open")).toBe("Closed");
    expect(calculateRegistrationStatus(soon, "Open")).toBe("Closing Soon");
    expect(calculateRegistrationStatus(later, "Open")).toBe("Open");
  });

  it("falls back to the declared status for missing/garbage deadlines", () => {
    expect(calculateRegistrationStatus(undefined, "Closed")).toBe("Closed");
    expect(calculateRegistrationStatus("garbage", "Unknown")).toBe("Unknown");
    expect(calculateRegistrationStatus(undefined)).toBe("Unknown");
  });
});

describe("computeSyncHash", () => {
  it("is stable for identical content and changes when content changes", () => {
    const a = event({ title: "Same", organizer: "Org" });
    const b = event({ title: "Same", organizer: "Org" });
    const c = event({ title: "Different", organizer: "Org" });
    expect(computeSyncHash(a)).toBe(computeSyncHash(b));
    expect(computeSyncHash(a)).not.toBe(computeSyncHash(c));
  });
});

describe("deduplicateHackathons", () => {
  it("merges cross-platform duplicates and unions themes/skills", () => {
    const result = deduplicateHackathons([
      event({ title: "BuildFest 2026", source_platform: "Devfolio", themes: ["AI/ML"], skills: ["Python"], description: "short" }),
      event({ title: "BuildFest 2026", source_platform: "Unstop", themes: ["Web"], skills: ["React"], description: "a much longer description from the other source" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].themes.sort()).toEqual(["AI/ML", "Web"]);
    expect(result[0].skills.sort()).toEqual(["Python", "React"]);
    expect(result[0].description).toContain("longer");
  });

  it("keeps distinct events from merging", () => {
    const result = deduplicateHackathons([
      event({ title: "Alpha Hack 2026" }),
      event({ title: "Beta Hack 2026" }),
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("generateCanonicalSlug", () => {
  it("normalizes case, punctuation and whitespace", () => {
    expect(generateCanonicalSlug("Smart India Hackathon 2026!")).toBe("smart-india-hackathon-2026");
  });
});
