import {
  availabilityFit,
  collaborationFit,
  goalDomainFit,
  roleCoverage,
  skillComplementarity,
} from "./features";
import { MATCH_ALGORITHM_VERSION } from "./types";
import type {
  MatchCandidateProfile,
  MatchEvaluation,
  MatchScores,
  TeamBrief,
} from "./types";

export const MATCH_WEIGHTS: Readonly<MatchScores> = {
  skills: 0.35,
  domain: 0.25,
  role: 0.2,
  availability: 0.1,
  collaboration: 0.1,
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * rules-v1 scoring. Normalizes every component to 0–1, applies the documented weights,
 * returns 0–100. Deterministic: same inputs, same outputs, always.
 */
export function scoreCandidate(
  candidate: MatchCandidateProfile,
  brief: TeamBrief,
): MatchEvaluation {
  const { score: skills, matchedSkills } = skillComplementarity(
    candidate.skills ?? [],
    brief.requiredSkills ?? [],
  );
  const features: MatchScores = {
    skills: clamp01(skills),
    domain: clamp01(goalDomainFit(candidate, brief)),
    role: clamp01(roleCoverage(candidate.roles ?? [], brief.requiredSkills ?? [])),
    availability: clamp01(availabilityFit(candidate.hoursPerWeek ?? "")),
    collaboration: clamp01(collaborationFit(
      candidate.collaboration ?? [],
      brief.collaborationPreferences ?? [],
    )),
  };

  const weighted =
    features.skills * MATCH_WEIGHTS.skills +
    features.domain * MATCH_WEIGHTS.domain +
    features.role * MATCH_WEIGHTS.role +
    features.availability * MATCH_WEIGHTS.availability +
    features.collaboration * MATCH_WEIGHTS.collaboration;

  const required = new Set(
    (brief.requiredSkills ?? []).map((r) => String(r.skill_name ?? "").toLowerCase().trim()),
  );
  const complementarySkills = (candidate.skills ?? [])
    .map((skill) => (typeof skill === "string" ? skill : skill?.name))
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .filter((name) => !required.has(name.toLowerCase().trim()))
    .slice(0, 5);

  const reasons = buildReasons(features, candidate, brief, matchedSkills);

  return {
    candidateId: candidate.uid,
    score: Math.round(clamp01(weighted) * 100),
    reasons,
    matchedSkills,
    complementarySkills,
    algorithmVersion: MATCH_ALGORITHM_VERSION,
    features,
  };
}

function topReasons(
  contributions: Array<{ weight: number; value: number; reason: string | null }>,
): string[] {
  return contributions
    .filter((entry) => entry.reason !== null)
    .map((entry) => ({ ...entry, contribution: entry.weight * entry.value }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4)
    .map((entry) => entry.reason as string);
}

/** Reasons are grounded in visible fields only — never inferred traits. */
function buildReasons(
  features: MatchScores,
  candidate: MatchCandidateProfile,
  brief: TeamBrief,
  matchedSkills: string[],
): string[] {
  const reasons = topReasons([
    {
      weight: MATCH_WEIGHTS.skills,
      value: features.skills,
      reason:
        matchedSkills.length > 0
          ? `Covers required skill${matchedSkills.length > 1 ? "s" : ""} ${matchedSkills.slice(0, 3).join(", ")}`
          : null,
    },
    {
      weight: MATCH_WEIGHTS.role,
      value: features.role,
      reason:
        features.role >= 0.5 && Array.isArray(candidate.roles) && candidate.roles.length > 0
          ? "Profile lists a preferred team role"
          : null,
    },
    {
      weight: MATCH_WEIGHTS.domain,
      value: features.domain,
      reason:
        features.domain >= 0.5 && brief.domain
          ? `Interests align with the team's ${brief.domain} focus`
          : null,
    },
    {
      weight: MATCH_WEIGHTS.availability,
      value: features.availability,
      reason:
        candidate.hoursPerWeek && candidate.hoursPerWeek !== "Flexible"
          ? `Available ${candidate.hoursPerWeek} per week`
          : features.availability > 0.5
            ? "Availability is listed and flexible"
            : null,
    },
    {
      weight: MATCH_WEIGHTS.collaboration,
      value: features.collaboration,
      reason:
        features.collaboration > 0.5 && candidate.collaboration?.length
          ? `Shares collaboration preference ${candidate.collaboration[0]}`
          : null,
    },
  ]);

  if (reasons.length === 0) {
    return ["Sparse overlapping signals — review the profile before requesting"];
  }
  return reasons.slice(0, 4);
}
