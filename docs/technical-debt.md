# PulsePoint — Technical Debt Ledger

Accepted and explicitly deferred items. Each has an owner decision and a re-entry condition. Do not silently grow this list; add items deliberately.

## TD-001 · `/api/hackathons` loads the entire catalog into memory

- **Status:** Accepted debt (recorded 2026-11-15, Phase 6 pre-work).
- **What:** `src/app/api/hackathons/route.ts` paginates the DB in 500-row batches and then filters/sorts/stats in JS — O(N) memory and latency per request for directory, stats, search, saved-filtering, and sync status.
- **Why deferred:** catalog is empty until sources are authorized or curated listings exist; premature index/pagination design.
- **Re-entry condition:** implement server-side filtering, pagination (`range`), and count/status aggregates (or a materialized stats row) when authorized listings exceed ~200 rows or latency p95 > 300 ms.
- **Suggested shape:** query params `page`/`pageSize`, `count` exact, filters (`query`, `mode`, `source`, `theme`, `status`, `featured`) in SQL, stats via RPC/materialized view refreshed on sync.

## TD-002 · rules-v1 scorer is uncalibrated on real student data

- **Status:** Accepted (recorded 2026-11-15, kept separate per founder decision).
- **What:** weights (35/25/20/10/10) are untested hypotheses; fixtures are synthetic; no Precision@5 on live usage.
- **Re-entry condition:** Phase C evaluation once ≥ 30–50 real completed profiles exist — expand fixtures, manual relevance labeling, weight ablation, then decide on embeddings. See `docs/ai/matching-v1.md`.
- **Do not:** ship weight changes or claim "AI-accurate" matching before that evaluation.

## Notes

- Hackathon squad drawer (`/api/hackathons/[id]/squad`) also scans up to 50 profiles in JS — same deferred profile until real catalog/profiles exist.
- Theme system relies on `[class~="…"]` utility overrides for light mode; replacing that layer is a dedicated refactor, not an inline fix.
