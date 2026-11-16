# Explainable matching — rules-v1

Status: **rules-v1 implemented and fixture-tested. Not yet evaluated on real student data (Phase C pending).**
No AI/LLM dependency. Deterministic — same inputs always produce the same outputs.

## Where it lives

- Pure scoring module: `src/lib/matching/` (`types.ts`, `features.ts`, `score.ts`)
- Fixtures: `tests/fixtures/matching/` (versioned synthetic profiles + team briefs)
- Tests: `tests/matching/score.test.ts` (`npm test`)
- API: `src/app/api/matching/suggest` (POST, leader-only, token-verified)
- Feedback capture: `src/app/api/matching/feedback` + `supabase/migrations/20261115000000_create_match_feedback.sql`
- UI: `src/components/teams/suggested-teammates.tsx` (team detail page, leader-only)

## Weights (initial hypotheses, not scientific truth)

| Feature | Weight | What it measures | Guardrail |
|---|---|---|---|
| Skill complementarity | 0.35 | Per required skill, candidate lists it, scaled by familiarity (Beginner 0.6 / unknown 0.7 / Comfortable 0.8 / Experienced 1.0) | Missing a *required* skill scores 0 for that skill; non-required skills never hurt |
| Goal / domain fit | 0.25 | Token overlap between candidate interests + `buildGoal` and brief domain/category/technologies | No team-side tokens → neutral 0.5 |
| Role coverage | 0.20 | Overlap between candidate roles and deduplicated preferred roles | No preferred roles or no candidate roles → neutral 0.5 |
| Availability fit | 0.10 | Heuristic bands: 1–3h 0.4 · 4–6h 0.6 · 7–10h 0.8 · 10+ 1.0 · Flexible 0.7 | Missing availability → neutral 0.5; never auto-zero |
| Collaboration preferences | 0.10 | Overlap of self-reported preferences | Either side missing → neutral 0.5 |

All components normalize to 0–1; total score = `round(Σ weight · feature × 100)`; clamped 0–100. Scores are **not probabilities** and are labeled as such in the UI.

## Rules

- **Missing data is neutral** (0.5), never modeled as 0.
- Reasons are grounded in visible fields (matched skills, roles, domain, availability, shared preferences) — at most 4, never inferred traits. Sparse profiles get an honest "sparse overlapping signals" message.
- Eligibility for discovery is filtered *before* scoring: `visibleToStudents !== false` and `completed === true`; current members and the caller are excluded. (Blocking/ineligibility tooling ships with the trust & support milestone.)
- Every suggestion carries `algorithmVersion: "rules-v1"`. Change weights or features → bump `MATCH_ALGORITHM_VERSION` and re-run the fixture set.
- Feedback (`dismissed` / `requested` / `accepted` / `rejected`) is private, consented, first-party; used only for evaluation; never used to silently hide a student.

## Evaluation plan (Phase C — not started)

1. Expand fixtures to 30–50 synthetic/consented profiles × 10–15 briefs covering edge cases (missing skills/availability, full teams, disabled accounts).
2. Manual Precision@5 rating of the top-5 for each brief; keep the evaluation set versioned alongside fixtures.
3. Track Precision@5, request rate, accepted rate; run weight ablations before adopting new features.
4. Only then consider embeddings/semantic matching (post-MVP) with a deterministic fallback.

## Versioning & change log

- `rules-v1` (2026-11-15): initial deterministic baseline, fixture-tested on 24 synthetic profiles × 6 briefs. Awaiting live DB migration + Phase C evaluation. Do not claim "AI-accurate" matching anywhere; it is a transparent heuristic.
