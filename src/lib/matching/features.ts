import type { CandidateSkill, TeamBrief, TeamBriefRequirement } from "./types";

/** Lowercase, collapse whitespace, drop punctuation noise. Deterministic. */
export function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeSkillName(skill: CandidateSkill | string): CandidateSkill | null {
  const name = typeof skill === "string" ? skill : skill?.name;
  if (typeof name !== "string") return null;
  const normalized = normalizeToken(name);
  if (!normalized) return null;
  return {
    name: normalized,
    level: typeof skill === "object" && typeof skill.level === "string" ? skill.level : undefined,
  };
}

export function normalizeSkillList(skills: Array<CandidateSkill | string>): CandidateSkill[] {
  const seen = new Set<string>();
  const result: CandidateSkill[] = [];
  for (const raw of Array.isArray(skills) ? skills : []) {
    const skill = normalizeSkillName(raw);
    if (!skill || seen.has(skill.name)) continue;
    seen.add(skill.name);
    result.push(skill);
  }
  return result;
}

/** Comfortable/Experienced signals weigh more, but a Beginner is never zeroed out for listing a skill. */
export function levelWeight(level?: string): number {
  switch (normalizeToken(level ?? "")) {
    case "experienced":
      return 1;
    case "comfortable":
      return 0.8;
    case "beginner":
      return 0.6;
    default:
      return 0.7; // unknown level — mild positive, missing data must not be penalized
  }
}

function tokens(value: string): string[] {
  const STOP = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "our",
    "app", "application", "project", "platform", "using", "use",
  ]);
  return normalizeToken(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

/**
 * Skill complementarity (0.35).
 * Per required skill: full coverage if the candidate lists it, scaled by familiarity level.
 * Missing a required skill scores 0 for that skill — but non-listed optional skills never hurt.
 */
export function skillComplementarity(
  candidateSkills: CandidateSkill[],
  requirements: TeamBriefRequirement[],
): { score: number; matchedSkills: string[] } {
  if (requirements.length === 0) return { score: 0.5, matchedSkills: [] };
  const candidate = normalizeSkillList(candidateSkills);
  let coverage = 0;
  const matched: string[] = [];
  for (const requirement of requirements) {
    const wanted = normalizeSkillName(requirement.skill_name)?.name;
    if (!wanted) continue;
    const hit = candidate.find((skill) => skill.name === wanted);
    if (hit) {
      coverage += levelWeight(hit.level);
      matched.push(requirement.skill_name);
    }
  }
  return { score: Math.min(1, coverage / requirements.length), matchedSkills: matched };
}

/**
 * Goal / domain fit (0.25).
 * Overlap between self-declared interests/buildGoal and the brief's domain/category/technologies.
 * No team-side tokens → neutral 0.5 (nothing to compare against).
 */
export function goalDomainFit(
  candidate: { interests: string[]; buildGoal: string },
  brief: TeamBrief,
): number {
  const teamTokens = tokens(
    [brief.domain, brief.category, ...brief.technologies].join(" "),
  );
  if (teamTokens.length === 0) return 0.5;
  const haystack = normalizeToken(
    [...(candidate.interests ?? []), candidate.buildGoal ?? ""].join(" "),
  );
  if (!haystack) return 0.5; // candidate gave no goals — neutral, not zero
  const matched = teamTokens.filter((token) => haystack.includes(token)).length;
  return Math.min(1, matched / teamTokens.length);
}

/**
 * Role coverage (0.20).
 * Overlap between candidate roles and the deduplicated preferred roles in the brief.
 */
export function roleCoverage(candidateRoles: string[], requirements: TeamBriefRequirement[]): number {
  const wanted = Array.from(
    new Set(
      requirements
        .map((requirement) => normalizeToken(requirement.preferred_role ?? ""))
        .filter(Boolean),
    ),
  );
  if (wanted.length === 0) return 0.5;
  const candidate = (candidateRoles ?? []).map(normalizeToken).filter(Boolean);
  if (candidate.length === 0) return 0.5;
  const matched = wanted.filter((role) =>
    candidate.some((own) => own === role || own.includes(role) || role.includes(own)),
  ).length;
  return Math.min(1, matched / wanted.length);
}

/**
 * Availability fit (0.10).
 * Heuristic bands, keyed on alphanumerics only so "1–3 hours" and "1-3 hours" behave identically.
 * Missing/flexible availability is neutral — availability is optional and must not gate matching.
 */
export function availabilityFit(hoursPerWeek: string): number {
  const key = normalizeToken(hoursPerWeek ?? "").replace(/[^a-z0-9]/g, "");
  switch (key) {
    case "13hours":
      return 0.4;
    case "46hours":
      return 0.6;
    case "710hours":
      return 0.8;
    case "10hours":
    case "10plushours":
      return 1;
    case "flexible":
      return 0.7;
    default:
      return 0.5;
  }
}

/**
 * Collaboration preferences (0.10).
 * Overlap of self-reported preferences; either side missing → neutral 0.5.
 */
export function collaborationFit(candidate: string[], team: string[]): number {
  const teamPrefs = (team ?? []).map(normalizeToken).filter(Boolean);
  const ownPrefs = (candidate ?? []).map(normalizeToken).filter(Boolean);
  if (teamPrefs.length === 0 || ownPrefs.length === 0) return 0.5;
  const matched = teamPrefs.filter((pref) =>
    ownPrefs.some((own) => own === pref || own.includes(pref) || pref.includes(own)),
  ).length;
  return Math.min(1, matched / teamPrefs.length);
}
