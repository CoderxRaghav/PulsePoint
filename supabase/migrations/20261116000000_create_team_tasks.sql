-- Team collaboration space: lightweight task board for teams.
-- Server-only access, mirroring the team formation posture: no client policies, service role only.
-- Optional per-team task due dates (date-only, calendar day, no time zone math).

create table if not exists public.team_tasks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 140),
  details text not null default '' check (char_length(details) <= 1000),
  assignee_uid text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  due_date date null,
  created_by text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists idx_team_tasks_team_status
  on public.team_tasks (team_id, status, created_at desc);
create index if not exists idx_team_tasks_assignee
  on public.team_tasks (assignee_uid) where assignee_uid is not null;
create index if not exists idx_team_tasks_due_date
  on public.team_tasks (due_date) where due_date is not null;

create or replace function public.set_team_tasks_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_team_tasks_updated_at on public.team_tasks;
create trigger set_team_tasks_updated_at
  before update on public.team_tasks
  for each row execute function public.set_team_tasks_updated_at();

alter table public.team_tasks enable row level security;

revoke all on table public.team_tasks from public, anon, authenticated;
grant select, insert, update, delete on table public.team_tasks to service_role;
