-- ==============================================================================
-- Migration: 20261117000000_phase5_opportunities.sql
-- Description: Phase 5 — curator workflow, student suggestions, audit log,
--              archival helper, and tighter public read policies for the catalog.
-- Safety: additive only. No existing rows, columns, or data are modified or
--         deleted. The only policy change narrows public SELECT visibility on
--         the (currently empty) hackathons cache to verified, unarchived rows.
-- ==============================================================================

-- 1. Curator accountability columns (write path goes through server routes only)
alter table public.hackathons
  add column if not exists submitted_by text,    -- Firebase UID of the curator, or 'seed' marker
  add column if not exists curation_notes text;  -- internal curator notes, never rendered publicly

-- Curated rows must have unique slugs; slug stays non-unique globally because
-- external feeds from different platforms may legitimately share one.
create unique index if not exists idx_hackathons_curated_slug
  on public.hackathons (slug)
  where source_platform = 'Curated';

-- 2. Student-submitted event suggestions (pending review — never auto-published)
create table if not exists public.hackathon_suggestions (
  id uuid primary key default gen_random_uuid(),
  submitted_by text not null,                  -- Firebase UID of the student
  title text not null,
  organizer text,
  source_url text not null,                    -- official listing page (validated http/https)
  apply_url text not null,                     -- official registration link (validated http/https)
  mode text check (mode in ('Online', 'In Person', 'Hybrid')),
  location text,
  registration_deadline timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  prize_pool text,
  description text,
  eligibility text,
  themes text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'published')),
  reviewer_uid text,                           -- curator who last reviewed, null while pending
  review_notes text,                           -- curator notes (rejection reason, publish notes)
  reviewed_at timestamptz,
  published_hackathon_id text references public.hackathons(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hackathon_suggestions_status
  on public.hackathon_suggestions (status, created_at asc);
create index if not exists idx_hackathon_suggestions_submitter
  on public.hackathon_suggestions (submitted_by, created_at desc);

-- 3. Audit log for privileged curator actions (insert-only, service role only)
create table if not exists public.hackathon_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_uid text not null,            -- Firebase UID of the curator, or 'seed-script'
  action text not null check (action in (
    'create', 'update', 'verify', 'archive', 'unarchive', 'feature', 'unfeature',
    'suggestion_approve', 'suggestion_reject', 'suggestion_publish', 'suggestion_edit',
    'archive_expired', 'seed'
  )),
  hackathon_id text,
  suggestion_id uuid,
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hackathon_audit_log_created
  on public.hackathon_audit_log (created_at desc);

-- 4. Archival helper: soft-archive long-expired events. Never deletes rows,
--    so bookmarks (FK on delete restrict) survive. Archived rows are hidden
--    from listings but remain valid detail-page links.
create or replace function public.archive_expired_hackathons()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
begin
  update public.hackathons
  set archived_at = pg_catalog.now()
  where archived_at is null
    and coalesce(end_date, registration_deadline) is not null
    and coalesce(end_date, registration_deadline) < pg_catalog.now() - interval '14 days';
  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.archive_expired_hackathons() from public, anon, authenticated;
grant execute on function public.archive_expired_hackathons() to service_role;

-- updated_at trigger for suggestions (mirrors the hackathons pattern)
create or replace function public.set_hackathon_suggestions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_hackathon_suggestions_updated_at on public.hackathon_suggestions;
create trigger set_hackathon_suggestions_updated_at
  before update on public.hackathon_suggestions
  for each row
  execute function public.set_hackathon_suggestions_updated_at();

-- 5. RLS: enable on the new tables; no client access at all (server-only).
alter table public.hackathon_suggestions enable row level security;
alter table public.hackathon_audit_log enable row level security;
revoke all on public.hackathon_suggestions from anon, authenticated;
revoke all on public.hackathon_audit_log from anon, authenticated;

-- 6. Tighten public catalog reads to verified, unarchived rows.
--    Server routes use the service secret (bypasses RLS) and filter themselves;
--    the browser never queries PostgREST directly. This only narrows what a
--    leaked anon key could read.
drop policy if exists "Allow public read access to hackathons" on public.hackathons;
create policy "Allow public read access to hackathons"
  on public.hackathons
  for select
  to anon, authenticated
  using (verified = true and archived_at is null);
