# Hackathon curation runbook

Phase 5 operators: manual, human-verified curation is the only published path until SIH/organizer feeds are authorized in `docs/hackathons-sources.md`. This doc covers the full cycle.

## One-time setup (local dev)

1. Apply `supabase/migrations/20261117000000_phase5_opportunities.sql` in the Supabase SQL editor (additive; no existing data is modified).
2. Set `HACKATHON_CURATOR_UIDS` in `.env.local` — server-only, comma-separated Firebase UIDs, no `NEXT_PUBLIC_` prefix. Currently configured for the founder UID on this machine. Production/hosting needs the same variable set separately.
3. Sign in to the app as that Firebase user, then visit `/hackathons/manage` — you should see "Curation console". Everyone else sees an access-denied screen.

Verify the server sees the config without writing anything:

```bash
curl -i http://localhost:3100/api/admin/me                       # 401 without a token
curl -i -H "Authorization: Bearer invalid" http://localhost:3100/api/admin/me   # 401
```

## Everyday curation

- **Publish a listing from scratch**: `/hackathons/manage` → "New curated listing", or `POST /api/admin/hackathons`. Every field comes from the official organizer page — never invent deadlines, prizes, organizers, or links. Duplicates are caught by canonical slug and return `409` with matches; resubmit with `confirm_duplicate: true` only for a genuinely distinct event.
- **Publish from a student suggestion**: `/hackathons/manage` → Suggestion queue → check both URLs, edit if needed, "Approve & publish". Publishing creates a verified `Curated` listing and links it to the suggestion. Students can track their own submissions at `/hackathons/suggest`.
- **Housekeeping**: Catalog tab → Verify / Feature / Archive / Restore; "Archive expired now" soft-archives events ≥ 14 days past their end/deadline. Archived rows are never deleted; bookmarked detail pages keep working with an "ended" banner.
- **Audit**: every privileged action writes `hackathon_audit_log` (`actor_uid`, `action`, `diff`, `created_at`). The table has no client grants.

## Seeding the catalog

```bash
npm run seed:hackathons            # dry run: validates seeds/hackathons.curated.json
npm run seed:hackathons -- --apply # writes through SUPABASE_SECRET_KEY (server-side)
```

Rules: verified events only; placeholder titles are skipped; the script never fetches URLs; nothing is deleted; every seeded event gets a `seed-script` audit row.

## Security model

- Reads are public only for verified + unarchived rows (API and RLS-narrowed PostgREST). Drafts/unverified never leave the server.
- All writes go through `/api/admin/*` (curator allowlist + Firebase token verification) or the service-secret seed script. The service secret never reaches the browser.
- `hackathon_suggestions` and `hackathon_audit_log` have RLS enabled and **zero** `anon`/`authenticated` grants; only the service role can read/write them.
- Sync (`POST /api/hackathons/sync`) is curator-only; automated sources remain disabled until written authorization is recorded in the sources ledger.

## Verification (performed 2026-11-16, production)

Live E2E against the production server (`npm start`, port 3100) using synthetic users and tagged records only; zero residual rows; founder data untouched.

```bash
# one-time setup for a repeatable run (local only):
#   1. append the synthetic curator uid to HACKATHON_CURATOR_UIDS in .env.local
#   2. npm start, then:
PHASE5_RUN_ID=<id> node tests/e2e/phase5-hackathons.cjs
#   3. cleanup (ownership-verified; aborts on any mismatch):
PHASE5_RUN_ID=<same id> node tests/e2e/phase5-hackathons-cleanup.cjs
#   4. restore .env.local to the founder-only allowlist
```

37/37 checks passed on 2026-11-16, including: curator allowlist authorization (200/401/403), student 403s on all curator routes, suggestion submit → duplicate-409 → per-submitter scoping → queue → approve/reject/publish, published listing visible in public search + detail, unique-slug `23505` enforcement, bookmark + FK `23503` protect of bookmarked listings, archive hide / unarchive restore, past-deadline hidden-by-default vs `include_closed` Closed, `archive-expired` safe call, and curator-only sync. All synthetic rows/users deleted and verified absent afterwards (`hackathons`, `hackathon_suggestions`, `hackathon_audit_log`, `saved_hackathons` all 0 rows; founder profile intact).

For a full schema read-back after applying the migration, run in the Supabase SQL editor:

```sql
select tablename, policyname, cmd, qual from pg_policies
  where schemaname = 'public' and tablename in ('hackathons','hackathon_suggestions','hackathon_audit_log');
select indexname from pg_indexes where schemaname = 'public'
  and tablename in ('hackathons','hackathon_suggestions','hackathon_audit_log');
```

