-- ==============================================================================
-- Migration: 20261107000000_create_hackathons_aggregator.sql
-- Description: Lightweight multi-source hackathon cache, sync state, and user bookmarks
-- ==============================================================================

-- 1. Cached hackathons metadata table (aggregated from external sources of truth)
create table if not exists public.hackathons (
  id text primary key,
  slug text not null unique,
  title text not null,
  organizer text not null,
  source_platform text not null,
  source_url text not null,
  apply_url text not null,
  banner_url text,
  mode text not null default 'Online',
  location text default 'Worldwide',
  registration_status text not null default 'Open',
  registration_deadline timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  prize_pool text default 'Unspecified',
  prize_usd numeric default 0,
  themes text[] default '{}',
  skills text[] default '{}',
  team_size_min int default 1,
  team_size_max int default 4,
  description text not null,
  eligibility text default 'Open to all students & builders',
  featured boolean default false,
  verified boolean default true,
  sync_hash text not null,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger to keep updated_at in sync
create or replace function public.set_hackathons_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_hackathons_updated_at on public.hackathons;
create trigger set_hackathons_updated_at
  before update on public.hackathons
  for each row
  execute function public.set_hackathons_updated_at();

-- Performance indexes for search, filtering, and sorting
create index if not exists idx_hackathons_status on public.hackathons (registration_status);
create index if not exists idx_hackathons_source on public.hackathons (source_platform);
create index if not exists idx_hackathons_mode on public.hackathons (mode);
create index if not exists idx_hackathons_deadline on public.hackathons (registration_deadline);
create index if not exists idx_hackathons_featured on public.hackathons (featured);
create index if not exists idx_hackathons_themes on public.hackathons using gin (themes);
create index if not exists idx_hackathons_skills on public.hackathons using gin (skills);

-- 2. Global Synchronization State & Lock Table
create table if not exists public.hackathon_sync_state (
  source text primary key,
  status text not null default 'idle',
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,
  total_discovered int default 0,
  total_inserted int default 0,
  total_updated int default 0,
  last_error text,
  metadata jsonb default '{}'::jsonb
);

-- Initialize global state record if absent
insert into public.hackathon_sync_state (source, status, last_sync_completed_at, total_discovered, metadata)
values ('global', 'idle', now() - interval '2 days', 0, '{"version": "1.0", "engine": "pulsepoint-aggregator"}'::jsonb)
on conflict (source) do nothing;

-- 3. User Bookmarks (User-isolated storage keyed by Firebase UID)
create table if not exists public.saved_hackathons (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  hackathon_id text not null references public.hackathons(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, hackathon_id)
);

create index if not exists idx_saved_hackathons_user on public.saved_hackathons (user_id);
create index if not exists idx_saved_hackathons_event on public.saved_hackathons (hackathon_id);

-- 4. Row Level Security (RLS)
alter table public.hackathons enable row level security;
alter table public.hackathon_sync_state enable row level security;
alter table public.saved_hackathons enable row level security;

-- Public can read hackathons catalog
drop policy if exists "Allow public read access to hackathons" on public.hackathons;
create policy "Allow public read access to hackathons"
  on public.hackathons
  for select
  using (true);

-- Public can read sync state (for showing last-updated indicator on UI)
drop policy if exists "Allow public read access to sync state" on public.hackathon_sync_state;
create policy "Allow public read access to sync state"
  on public.hackathon_sync_state
  for select
  using (true);

-- Users can read their own saved hackathons
drop policy if exists "Users can read own saved hackathons" on public.saved_hackathons;
create policy "Users can read own saved hackathons"
  on public.saved_hackathons
  for select
  using (
    (select auth.jwt() ->> 'iss') like 'https://securetoken.google.com/%'
    and (select auth.jwt() ->> 'sub') = user_id
  );

-- Users can insert their own saved hackathons
drop policy if exists "Users can save hackathons" on public.saved_hackathons;
create policy "Users can save hackathons"
  on public.saved_hackathons
  for insert
  with check (
    (select auth.jwt() ->> 'iss') like 'https://securetoken.google.com/%'
    and (select auth.jwt() ->> 'sub') = user_id
  );

-- Users can remove their own saved hackathons
drop policy if exists "Users can delete own saved hackathons" on public.saved_hackathons;
create policy "Users can delete own saved hackathons"
  on public.saved_hackathons
  for delete
  using (
    (select auth.jwt() ->> 'iss') like 'https://securetoken.google.com/%'
    and (select auth.jwt() ->> 'sub') = user_id
  );

