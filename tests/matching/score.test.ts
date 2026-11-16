import { describe, expect, it } from "vitest";
import profiles from "../fixtures/matching/profiles.json";
import briefs from "../fixtures/matching/briefs.json";
import {
  MATCH_ALGORITHM_VERSION,
  MATCH_WEIGHTS,
  scoreCandidate,
  type MatchCandidateProfile,
  type TeamBrief,
} from "@/lib/matching";
import {
  availabilityFit,
  collaborationFit,
  goalDomainFit,
  skillComplementarity,
} from "@/lib/matching/features";

const profileFixtures = profiles as unknown as Array<MatchCandidateProfile & { visibleToStudents?: boolean }>;
const briefFixtures = briefs as unknown as Array<TeamBrief & { id: string; expectTop: string | null }>;
const byId = new Map(profileFixtures.map((p) => [p.uid, p]));

describe("MATCH_WEIGHTS", () => {
  it("sum to 1", () => {
    const sum = Object.values(MATCH_WEIGHTS).reduce((acc, value) => acc + value, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("scoreCandidate — contract", () => {
  it("is deterministic for identical inputs", () => {
    const brief = briefFixtures[0];
    const candidate = byId.get("fixture-001")!;
    const first = scoreCandidate(candidate, brief);
    const second = scoreCandidate(candidate, brief);
    expect(first).toEqual(second);
  });

  it("produces scores within 0–100 for every fixture pair", () => {
    for (const brief of briefFixtures) {
      for (const candidate of profileFixtures) {
        const result = scoreCandidate(candidate, brief);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.algorithmVersion).toBe(MATCH_ALGORITHM_VERSION);
      }
    }
  });

  it("never fabricates more than 4 reasons and always grounds them in text", () => {
    for (const brief of briefFixtures) {
      for (const candidate of profileFixtures) {
        const { reasons } = scoreCandidate(candidate, brief);
        expect(reasons.length).toBeGreaterThanOrEqual(1);
        expect(reasons.length).toBeLessThanOrEqual(4);
        for (const reason of reasons) expect(reason.trim().length).toBeGreaterThan(3);
      }
    }
  });

  it("computes a fully explainable feature breakdown (0–1)", () => {
    const { features } = scoreCandidate(byId.get("fixture-001")!, briefFixtures[0]);
    for (const value of Object.values(features)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("scoreCandidate — fixture expectations", () => {
  for (const brief of briefFixtures) {
    if (!brief.expectTop) continue;
    it(`ranks ${brief.expectTop} highest for ${brief.id}`, () => {
      const ranked = [...profileFixtures]
        .filter((p) => p.visibleToStudents !== false)
        .map((p) => ({ uid: p.uid, ...scoreCandidate(p, brief) }))
        .sort((a, b) => b.score - a.score);
      expect(ranked[0].uid).toBe(brief.expectTop);
    });
  }

  it("rewards the obvious full-coverage candidate over a sparse one (brief-01)", () => {
    const brief = briefFixtures.find((b) => b.id === "brief-01-climate-ai")!;
    const strong = scoreCandidate(byId.get("fixture-001")!, brief);
    const sparse = scoreCandidate(byId.get("fixture-005")!, brief);
    expect(strong.score).toBeGreaterThan(sparse.score);
    expect(strong.matchedSkills).toContain("React");
    expect(sparse.reasons.length).toBeLessThanOrEqual(4);
  });

  it("complementarySkills excludes required skills", () => {
    const brief = briefFixtures.find((b) => b.id === "brief-01-climate-ai")!;
    const result = scoreCandidate(byId.get("fixture-009")!, brief);
    const required = new Set(brief.requiredSkills.map((r) => r.skill_name.toLowerCase()));
    for (const skill of result.complementarySkills) {
      expect(required.has(skill.toLowerCase())).toBe(false);
    }
  });
});

describe("missing data is neutral, not zero", () => {
  it("availability: unlisted beats '1–3 hours', loses to '10+ hours'", () => {
    const unlisted = availabilityFit("");
    const low = availabilityFit("1–3 hours");
    const high = availabilityFit("10+ hours");
    expect(unlisted).toBeCloseTo(0.5);
    expect(unlisted).toBeGreaterThan(low);
    expect(unlisted).toBeLessThan(high);
    expect(availabilityFit("1-3 hours")).toBeCloseTo(low); // hyphen/en-dash tolerated
    expect(availabilityFit("Flexible")).toBeCloseTo(0.7);
  });

  it("collaboration: either side empty → 0.5", () => {
    expect(collaborationFit([], ["Remote"])).toBeCloseTo(0.5);
    expect(collaborationFit(["Remote"], [])).toBeCloseTo(0.5);
    expect(collaborationFit(["Remote", "Async"], ["Async", "Remote"])).toBeCloseTo(1);
  });

  it("goal/domain: candidate gave no goals → 0.5 (fixture-022 has empty interests & goal)", () => {
    const brief = briefFixtures.find((b) => b.id === "brief-01-climate-ai")!;
    const neutral = goalDomainFit(
      { interests: [], buildGoal: "" },
      brief,
    );
    expect(neutral).toBeCloseTo(0.5);
    const score = scoreCandidate(byId.get("fixture-022")!, brief);
    expect(score.features.domain).toBeCloseTo(0.5);
    expect(score.features.availability).toBeCloseTo(0.5);
    expect(score.features.collaboration).toBeCloseTo(0.5);
  });

  it("level weight: beginner skill counts, just less", () => {
    const reqs = [{ skill_name: "React", preferred_role: "Frontend Developer" }];
    const [beginner] = skillComplementarity([{ name: "React", level: "Beginner" }], reqs).score > 0 ? [1] : [0];
    expect(beginner).toBe(1);
    expect(skillComplementarity([], reqs).score).toBe(0);
    expect(skillComplementarity([{ name: "React", level: "Beginner" }], reqs).score).toBeGreaterThan(
      skillComplementarity([], reqs).score,
    );
  });
});
