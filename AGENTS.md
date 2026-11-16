<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## PulsePoint

Single Next.js 16 (App Router) + React 19 + Tailwind v4 app — not a monorepo. Identity is Firebase Auth (UID is the immutable user id); data lives in Supabase Postgres; media in Supabase Storage. Path alias `@/*` → `src/*`.

## Commands

- `npm run dev` / `npm run build` / `npm run start` / `npm run lint` (ESLint only) / `npm test` (vitest, matching module fixtures).
- `npm run test:e2e` — live regression suite (synthetic users, tagged records). Requires the production server on port 3100 (`npm run build && npm start`) and the local environment. Creates ONLY `e2etest-*`/`E2E Test *` records and deletes them via ownership-verified cleanup afterwards. Never run it against production data or with real users on the target project.
- No CI runner config beyond `.github/workflows/ci.yml` (lint → typecheck → unit tests → build; live E2E intentionally excluded — needs a real DB). Verify changes with `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
- Node v20 or v24; npm v10+.

## Next.js 16 specifics

- `next.config.ts` enables `cacheComponents` and `partialPrefetching` — dynamic data in routes/pages may need `"use cache"` / Suspense or a build error. Check `node_modules/next/dist/docs/01-app` before editing routes.
- Tailwind v4 CSS runs through `@tailwindcss/turbopack` (see `turbopack.rules` in `next.config.ts`); design tokens live in `src/app/globals.css`. Don't add a PostCSS/tailwind.config setup.

## Environment & secrets

- Copy `.env.example` to `.env.local` (gitignored). `SUPABASE_URL` must be the project URL without `/rest/v1`.
- `SUPABASE_SECRET_KEY`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` are server-only. `src/lib/firebase-admin.ts` and `src/lib/supabase-admin.ts` start with `import "server-only"` — keep them (and anything importing them) out of client components.
- `FIREBASE_ADMIN_PRIVATE_KEY` needs literal `\n` sequences; the admin lib converts them.

## Architecture invariants

- Request flow for every privileged write: browser sends Firebase ID token → Route Handler verifies it (`verifyFirebaseIdToken` / `authenticatedTeamUid`) → server uses the Supabase secret key, which **bypasses RLS**. Teams/hackathons tables have RLS with no client policies, so never query them from the browser and never skip token verification in a mutation route.
- Team mutations (create, join decisions, membership changes, leadership transfer, capacity/member_count/positions_open updates) go through PostgreSQL RPC functions in `supabase/migrations/20261112000000_create_team_formation.sql`, not direct table writes. Capacity is rechecked inside the transaction — don't reimplement it in JS.
- `team-logos` and `profile-photos` are public buckets; uploads only via `POST /api/teams/logo` / `POST /api/profile/avatar` (5 MB, JPG/PNG/WebP/GIF). Logo URLs must point at PulsePoint storage (`isTeamLogoUrl`).

## Hackathon aggregator — do not enable connectors

- All sources are `permission_pending` or `blocked_without_explicit_authorization` in `src/lib/aggregator/source-policy.ts`. Do not flip a source to `authorized`, scrape, or add a provider without documented written approval recorded in `docs/hackathons-sources.md` (that doc is the approval ledger). No paid provider is approved.
- Sync cadence: 84 h global, 15 min retry cooldown on failure. Rows are a cache of external listings; bookmarks survive archival.

## Database setup

- No migration runner. Apply `supabase/migrations/*.sql` manually in filename order: profiles → hackathons aggregator → harden_hackathons_sync → team_formation → match_feedback. The team migration also creates the `team-logos` bucket and the server-only RPC functions.
- `member_count` / `positions_open` are maintained only by the DB functions; don't update them from app code.

## Docs drift

README's "Project Structure" and "Roadmap Scope & Limitations" sections are stale (they describe backend as not connected and list a placeholder-only tree; auth/profile/teams/hackathons are all implemented). Trust the code, `docs/team-formation.md`, and `docs/hackathons-sources.md`.
