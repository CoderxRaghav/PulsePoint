# Team Formation

PulsePoint team data is stored in Supabase PostgreSQL. Firebase Authentication remains the identity provider; API requests carry a Firebase ID token, which the Next.js Route Handlers verify with Firebase Admin before using the server-only Supabase secret key.

## Database setup

Apply `supabase/migrations/20261112000000_create_team_formation.sql` after the existing profile and hackathon migrations. It creates:

- `teams`, `projects`, `team_members`, `team_required_skills`, and `team_join_requests`.
- Indexes, foreign keys, uniqueness constraints, update timestamps, and RLS.
- Server-only PostgreSQL functions for atomic team creation/updates, join requests, request decisions, membership changes, and leadership transfer.
- The public `team-logos` Storage bucket with a 5 MB image limit.

The team tables have RLS enabled and no client-access policies. The app reads and mutates them only through authenticated Next.js APIs using `SUPABASE_SECRET_KEY`; never expose that key to the browser. The service key bypasses RLS, so every mutation route must continue to verify the Firebase token and every privileged database function must validate its actor UID.

The migration intentionally does not create foreign keys from team UIDs to `profiles`: Firebase UIDs are the identity source, and students can create a team before completing a profile. Profile details are joined by UID and privacy settings are honored when showing member details.

## Team workflow

- `POST /api/teams` validates the submitted team and project, then creates the team, first membership, project, and skill requirements in one database transaction.
- Join requests remain pending until the team lead accepts or rejects them. Applicants can withdraw pending requests and submit another after a prior request is rejected or withdrawn.
- Accepting a request locks the team row, checks its status and capacity, inserts the unique membership, decrements open positions, and accepts the request in a single transaction. This serializes concurrent accepts.
- Membership removal, leaving, and leadership transfer use database functions that verify the actor and update membership counts atomically.
- Team creation, edits, join decisions, and membership management require a verified Firebase ID token. Directory and team details are read through the server API.

## Logo uploads

Team logos are uploaded through `POST /api/teams/logo` to the public `team-logos` Supabase Storage bucket. The route verifies Firebase identity and permits only JPG, PNG, WebP, or GIF files up to 5 MB. No browser-side Supabase secret is used.

## Fields and status conventions

- Recruitment status is `open` or `closed`; archived teams have `archived_at` set and are excluded from discovery.
- Join-request status is `pending`, `accepted`, `rejected`, or `withdrawn`.
- `member_count` and `positions_open` are updated inside database functions; capacity checks are repeated on the server and in the transaction, not trusted to the form.
