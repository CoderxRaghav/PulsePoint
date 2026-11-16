/**
 * rules-v1 — deterministic, explainable teammate matching contract.
 *
 * Product principles (see docs/ai/matching-v1.md):
 * - Explain recommendations: every suggestion carries grounded, human-readable reasons.
 * - Opt-in and user-controlled: only candidates with `visibleToStudents` (and a completed
 *   profile) are eligible; eligibility is filtered before scoring, never inferred here.
 * - Missing data is neutral (0.5), never treated as zero or penalized.
 * - No AI dependency. This module is pure and fully reproducible for a given input set.
 */

export const MATCH_ALGORITHM_VERSION = "rules-v1" as const;

export type CandidateSkill = { name: string; level?: string };

export interface MatchCandidateProfile {
  uid: string;
  fullName?: string;
  headline?: string;
  college?: string;
  skills: CandidateSkill[];
  roles: string[];
  interests: string[];
  buildGoal: string;
  hoursPerWeek: string;
  collaboration: string[];
}

export interface TeamBriefRequirement {
  skill_name: string;
  preferred_role: string;
}

export interface TeamBrief {
  teamId?: string;
  domain: string;
  category: string;
  technologies: string[];
  requiredSkills: TeamBriefRequirement[];
  collaborationPreferences: string[];
}

export interface MatchScores {
  skills: number; // 0..1 weight 0.35 — skill complementarity
  domain: number; // 0..1 weight 0.25 — goal/domain fit
  role: number; // 0..1 weight 0.20 — role coverage
  availability: number; // 0..1 weight 0.10 — availability fit
  collaboration: number; // 0..1 weight 0.10 — collaboration preferences
}

export interface MatchSuggestion {
  candidateId: string;
  /** 0..100, a calibrated heuristic score — not a probability. */
  score: number;
  /** 2–4 concise reasons grounded in visible profile/team fields. */
  reasons: string[];
  matchedSkills: string[];
  /** Strong candidate skills not required by the brief (for context). */
  complementarySkills: string[];
  algorithmVersion: typeof MATCH_ALGORITHM_VERSION;
}

export interface MatchEvaluation extends MatchSuggestion {
  features: MatchScores;
}
