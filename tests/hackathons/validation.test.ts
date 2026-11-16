import { describe, expect, it } from "vitest";
import {
  slugifyTitle,
  validateCuratedHackathon,
  validateCuratedPatch,
  validateSuggestion,
} from "@/lib/hackathon-validation";

const validCurated = {
  title: "National Builders Hackathon",
  source_url: "https://organizer.example.org/builders-2026",
  apply_url: "https://organizer.example.org/builders-2026/register",
  organizer: "Example Foundation",
  mode: "Hybrid",
  registration_deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  start_date: new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString(),
  end_date: new Date(Date.now() + 41 * 24 * 3600 * 1000).toISOString(),
  prize_pool: "₹1,00,000",
  prize_usd: 1200,
  themes: ["AI/ML", "Fintech"],
  skills: ["React", "Node.js"],
  team_size_min: 2,
  team_size_max: 4,
  description: "A verified listing straight from the organizer.",
  eligibility: "Students from any recognized college.",
};

describe("slugifyTitle", () => {
  it("produces url-safe slugs", () => {
    expect(slugifyTitle("Smart India Hackathon 2026!")).toBe("smart-india-hackathon-2026");
    expect(slugifyTitle("  Multiple   Spaces---Everywhere  ")).toBe("multiple-spaces-everywhere");
    expect(slugifyTitle("C++ & DevOps: Security")).toBe("c-devops-security");
  });
});

describe("validateCuratedHackathon", () => {
  it("accepts a fully populated valid listing", () => {
    const result = validateCuratedHackathon(validCurated);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe("national-builders-hackathon");
      expect(result.value.featured).toBe(false);
    }
  });

  it("requires the two official URLs", () => {
    const result = validateCuratedHackathon({ ...validCurated, source_url: undefined, apply_url: "notaurl" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/source_url/);
      expect(result.errors.join(" ")).toMatch(/apply_url/);
    }
  });

  it("rejects non-http(s) and credential-bearing URLs", () => {
    for (const bad of ["javascript:alert(1)", "ftp://files.example.com/x", "https://user:pass@example.com/", "data:text/html,x"]) {
      const result = validateCuratedHackathon({ ...validCurated, apply_url: bad });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects past deadlines unless allow_expired is set", () => {
    const past = { ...validCurated, registration_deadline: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() };
    expect(validateCuratedHackathon(past).ok).toBe(false);
    expect(validateCuratedHackathon(past, { allowExpired: true }).ok).toBe(true);
  });

  it("rejects inverted date ranges and team sizes", () => {
    expect(
      validateCuratedHackathon({ ...validCurated, start_date: new Date(Date.now() + 50 * 24 * 3600 * 1000).toISOString(), end_date: new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString() }).ok
    ).toBe(false);
    expect(validateCuratedHackathon({ ...validCurated, team_size_min: 5, team_size_max: 2 }).ok).toBe(false);
  });

  it("rejects oversized lists and unknown enum values", () => {
    expect(validateCuratedHackathon({ ...validCurated, themes: Array(20).fill("x") }).ok).toBe(false);
    expect(validateCuratedHackathon({ ...validCurated, mode: "In-Person" }).ok).toBe(false);
  });

  it("never invents missing values — absent optional fields stay null", () => {
    const minimal = { ...validCurated } as Record<string, unknown>;
    delete minimal.organizer;
    delete minimal.description;
    delete minimal.themes;
    const result = validateCuratedHackathon(minimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.organizer).toBeNull();
      expect(result.value.description).toBeNull();
      expect(result.value.themes).toEqual([]);
    }
  });
});

describe("validateCuratedPatch", () => {
  it("accepts a valid partial update", () => {
    const result = validateCuratedPatch({ organizer: "New Organizer", featured: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ organizer: "New Organizer", featured: true });
    }
  });

  it("rejects invalid patches and empty updates", () => {
    expect(validateCuratedPatch({ prize_usd: -5 }).ok).toBe(false);
    expect(validateCuratedPatch({}).ok).toBe(false);
    expect(validateCuratedPatch("not-an-object").ok).toBe(false);
  });

  it("does not rename slugs through title edits", () => {
    const result = validateCuratedPatch({ title: "A Completely Different Title" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBeUndefined();
    }
  });
});

describe("validateSuggestion", () => {
  const validSuggestion = {
    title: "IIIT Bangalore TechSprint",
    source_url: "https://iiitb.ac.in/techsprint",
    apply_url: "https://iiitb.ac.in/techsprint/register",
    mode: "In Person",
    registration_deadline: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    description: "Student-run hackathon.",
    themes: ["Web Development"],
  };

  it("accepts a valid suggestion", () => {
    const result = validateSuggestion(validSuggestion);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("IIIT Bangalore TechSprint");
      expect(result.value.themes).toEqual(["Web Development"]);
    }
  });

  it("requires both official URLs and a sane title", () => {
    expect(validateSuggestion({ ...validSuggestion, apply_url: "" }).ok).toBe(false);
    expect(validateSuggestion({ ...validSuggestion, source_url: "javascript:x" }).ok).toBe(false);
    expect(validateSuggestion({ ...validSuggestion, title: "hi" }).ok).toBe(false);
  });

  it("accepts past deadlines — the curator decides at review time", () => {
    const past = validateSuggestion({
      ...validSuggestion,
      registration_deadline: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    });
    expect(past.ok).toBe(true);
  });

  it("never carries trust fields", () => {
    const result = validateSuggestion({ ...validSuggestion, verified: true, featured: true } as Record<string, unknown>);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty("verified");
      expect(result.value).not.toHaveProperty("featured");
    }
  });
});
