# Curated seed data

`hackathons.curated.json` is the seed source for the curated hackathon catalog.

Rules:

- Only verified events with genuine official registration links. Never invent
  events, deadlines, prizes, organizers, or URLs.
- Check every field against the official source before publishing.
- Replace the `REPLACE ME` placeholder before running the seed. Placeholder
  entries are skipped automatically.

Usage:

```bash
node scripts/seed-hackathons.mjs              # dry run — validates and reports, writes nothing
node scripts/seed-hackathons.mjs --apply      # writes through SUPABASE_SECRET_KEY (server-side only)
```

`hackathons.pending.json` holds entries that could not be verified against their
official pages in the latest QC pass (e.g. JS-gated sources). Pending entries are
**never seeded** — move an entry back into `hackathons.curated.json` only after
re-verifying it in a browser, then re-run the dry run. Entries with no published
`registration_deadline` are stored as `registration_status: "Unknown"` and must
not be presented as open registration.

The seed never fetches the URLs it stores, never deletes rows, and writes an
`hackathon_audit_log` entry per event (`actor_uid = 'seed-script'`). Archived
rows are excluded from listings but keep existing bookmarks valid.
