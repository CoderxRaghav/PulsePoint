-- Harden the lightweight external-event cache and make global lock acquisition atomic.

alter table public.hackathons
  add column if not exists source_event_id text,
  add column if not exists verified_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists last_seen_at timestamptz;

alter table public.hackathons
  alter column organizer drop not null,
  alter column mode drop not null,
  alter column mode drop default,
  alter column location drop default,
  alter column registration_status set default 'Unknown',
  alter column prize_pool drop default,
  alter column prize_usd drop default,
  alter column description drop not null,
  alter column eligibility drop default,
  alter column team_size_min drop default,
  alter column team_size_max drop default,
  alter column verified set default false;

alter table public.hackathons
  drop constraint if exists hackathons_slug_key;

alter table public.hackathons
  drop constraint if exists hackathons_registration_status_check;

alter table public.hackathons
  add constraint hackathons_registration_status_check
  check (registration_status in ('Open', 'Closing Soon', 'Closed', 'Unknown'));

create unique index if not exists idx_hackathons_source_event
  on public.hackathons (source_platform, source_event_id)
  where source_event_id is not null;
create index if not exists idx_hackathons_active_events
  on public.hackathons (registration_deadline, start_date)
  where archived_at is null and verified = true;
create index if not exists idx_hackathons_verified_at
  on public.hackathons (verified_at desc)
  where verified = true;

alter table public.hackathon_sync_state
  add column if not exists lock_token uuid,
  add column if not exists last_successful_sync_at timestamptz,
  add column if not exists total_unchanged integer not null default 0,
  add column if not exists total_failed integer not null default 0;

insert into public.hackathon_sync_state (source, status, metadata)
values
  ('Unstop', 'disabled', '{"approval_status":"permission_pending"}'::jsonb),
  ('HackerEarth', 'disabled', '{"approval_status":"permission_pending"}'::jsonb),
  ('Devfolio', 'disabled', '{"approval_status":"permission_pending"}'::jsonb),
  ('MLH', 'disabled', '{"approval_status":"permission_pending"}'::jsonb),
  ('Hack2skill', 'disabled', '{"approval_status":"permission_pending"}'::jsonb),
  ('SIH', 'disabled', '{"approval_status":"permission_pending"}'::jsonb),
  ('Devpost', 'disabled', '{"approval_status":"blocked_without_explicit_authorization"}'::jsonb),
  ('OrganizerFeed', 'disabled', '{"approval_status":"permission_pending"}'::jsonb)
on conflict (source) do nothing;

-- The original placeholder timestamp was not a completed provider refresh.
update public.hackathon_sync_state
set last_sync_completed_at = null
where source = 'global'
  and total_discovered = 0
  and total_inserted = 0
  and total_updated = 0
  and metadata ->> 'engine' = 'pulsepoint-aggregator';

create or replace function public.acquire_hackathon_sync_lock()
returns table (
  acquired boolean,
  result_status text,
  acquired_token uuid,
  last_sync_completed_at timestamptz,
  last_successful_sync_at timestamptz,
  next_refresh_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
  v_state public.hackathon_sync_state%rowtype;
begin
  insert into public.hackathon_sync_state (source, status)
  values ('global', 'idle')
  on conflict (source) do nothing;

  update public.hackathon_sync_state as sync_state
  set
    status = 'running',
    lock_token = v_token,
    last_sync_started_at = pg_catalog.now(),
    last_error = null
  where sync_state.source = 'global'
    and (
      sync_state.status <> 'running'
      or sync_state.last_sync_started_at is null
      or sync_state.last_sync_started_at < pg_catalog.now() - interval '15 minutes'
    )
    and (
      sync_state.last_successful_sync_at is null
      or sync_state.last_successful_sync_at <= pg_catalog.now() - interval '84 hours'
    )
    and (
      sync_state.status not in ('failed', 'partial')
      or sync_state.last_sync_completed_at is null
      or sync_state.last_sync_completed_at <= pg_catalog.now() - interval '15 minutes'
    )
  returning sync_state.* into v_state;

  if found then
    return query
      select true, 'acquired'::text, v_token,
        v_state.last_sync_completed_at,
        v_state.last_successful_sync_at,
        case
          when v_state.last_sync_completed_at is null then null
          else v_state.last_sync_completed_at + interval '84 hours'
        end;
    return;
  end if;

  select sync_state.* into v_state
  from public.hackathon_sync_state as sync_state
  where sync_state.source = 'global';

  return query
    select false,
      case
        when v_state.status = 'running'
          and v_state.last_sync_started_at >= pg_catalog.now() - interval '15 minutes'
          then 'locked'
        else 'cooldown'
      end,
      null::uuid,
      v_state.last_sync_completed_at,
      v_state.last_successful_sync_at,
      case
        when v_state.last_successful_sync_at > pg_catalog.now() - interval '84 hours'
          then v_state.last_successful_sync_at + interval '84 hours'
        when v_state.status in ('failed', 'partial')
          and v_state.last_sync_completed_at is not null
          then v_state.last_sync_completed_at + interval '15 minutes'
        when v_state.last_sync_completed_at is null then null
        else v_state.last_sync_completed_at + interval '84 hours'
      end;
end;
$$;

revoke all on function public.acquire_hackathon_sync_lock() from public, anon, authenticated;
grant execute on function public.acquire_hackathon_sync_lock() to service_role;

-- A stale worker cannot release a newer worker's lease.
create or replace function public.release_hackathon_sync_lock(
  p_lock_token uuid,
  p_status text,
  p_success boolean,
  p_total_discovered integer,
  p_total_inserted integer,
  p_total_updated integer,
  p_total_unchanged integer,
  p_total_failed integer,
  p_last_error text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'partial', 'failed') then
    raise exception 'Invalid hackathon sync status';
  end if;

  update public.hackathon_sync_state
  set
    status = p_status,
    lock_token = null,
    last_sync_completed_at = pg_catalog.now(),
    last_successful_sync_at = case
      when p_success and p_status = 'completed' then pg_catalog.now()
      else last_successful_sync_at
    end,
    total_discovered = greatest(coalesce(p_total_discovered, 0), 0),
    total_inserted = greatest(coalesce(p_total_inserted, 0), 0),
    total_updated = greatest(coalesce(p_total_updated, 0), 0),
    total_unchanged = greatest(coalesce(p_total_unchanged, 0), 0),
    total_failed = greatest(coalesce(p_total_failed, 0), 0),
    last_error = p_last_error,
    metadata = coalesce(p_metadata, '{}'::jsonb)
  where source = 'global'
    and status = 'running'
    and lock_token = p_lock_token;

  return found;
end;
$$;

revoke all on function public.release_hackathon_sync_lock(uuid, text, boolean, integer, integer, integer, integer, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.release_hackathon_sync_lock(uuid, text, boolean, integer, integer, integer, integer, integer, text, jsonb)
  to service_role;

-- Keep bookmarks attached to archived events and prevent accidental hard deletion.
alter table public.saved_hackathons
  drop constraint if exists saved_hackathons_hackathon_id_fkey;
alter table public.saved_hackathons
  add constraint saved_hackathons_hackathon_id_fkey
  foreign key (hackathon_id) references public.hackathons(id) on delete restrict;

-- Public clients can read the cache/status but cannot write aggregate records.
revoke all on public.hackathons from anon, authenticated;
grant select on public.hackathons to anon, authenticated;
revoke all on public.hackathon_sync_state from anon, authenticated;
grant select (
  source,
  status,
  last_sync_started_at,
  last_sync_completed_at,
  last_successful_sync_at,
  total_discovered,
  total_inserted,
  total_updated,
  total_unchanged,
  total_failed,
  last_error,
  metadata
) on public.hackathon_sync_state to anon, authenticated;
revoke all on public.saved_hackathons from anon, authenticated;
grant select, insert, delete on public.saved_hackathons to authenticated;

drop policy if exists "Allow public read access to hackathons" on public.hackathons;
create policy "Allow public read access to hackathons"
  on public.hackathons
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow public read access to sync state" on public.hackathon_sync_state;
create policy "Allow public read access to sync state"
  on public.hackathon_sync_state
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can read own saved hackathons" on public.saved_hackathons;
create policy "Users can read own saved hackathons"
  on public.saved_hackathons
  for select
  to authenticated
  using (
    (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/' || (select auth.jwt() ->> 'aud')
    and (select auth.jwt() ->> 'sub') = user_id
  );

drop policy if exists "Users can save hackathons" on public.saved_hackathons;
create policy "Users can save hackathons"
  on public.saved_hackathons
  for insert
  to authenticated
  with check (
    (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/' || (select auth.jwt() ->> 'aud')
    and (select auth.jwt() ->> 'sub') = user_id
  );

drop policy if exists "Users can delete own saved hackathons" on public.saved_hackathons;
create policy "Users can delete own saved hackathons"
  on public.saved_hackathons
  for delete
  to authenticated
  using (
    (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/' || (select auth.jwt() ->> 'aud')
    and (select auth.jwt() ->> 'sub') = user_id
  );
