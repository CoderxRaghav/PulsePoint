-- rules-v1 match feedback. Server-only: no client (anon/authenticated) access at all.
-- Leaders record how a ranked suggestion landed so the rules baseline can be evaluated (docs/ai/matching-v1.md).

create table if not exists public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  candidate_uid text not null,
  from_uid text not null,
  outcome text not null
    check (outcome in ('dismissed', 'requested', 'accepted', 'rejected')),
  algorithm_version text not null default 'rules-v1',
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists idx_match_feedback_team on public.match_feedback (team_id, created_at desc);
create index if not exists idx_match_feedback_candidate on public.match_feedback (candidate_uid, created_at desc);

alter table public.match_feedback enable row level security;

revoke all on table public.match_feedback from public, anon, authenticated;
grant select, insert on table public.match_feedback to service_role;
