create table if not exists public.profiles (
  uid text primary key,
  profile jsonb not null
    check (jsonb_typeof(profile) = 'object' and profile ->> 'uid' = uid),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profile_updated_at();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

create policy "Firebase users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.jwt() ->> 'iss') like 'https://securetoken.google.com/%'
    and (select auth.jwt() ->> 'sub') = uid
  );

create policy "Firebase users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (
    (select auth.jwt() ->> 'iss') like 'https://securetoken.google.com/%'
    and (select auth.jwt() ->> 'sub') = uid
  );

create policy "Firebase users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (
    (select auth.jwt() ->> 'iss') like 'https://securetoken.google.com/%'
    and (select auth.jwt() ->> 'sub') = uid
  )
  with check (
    (select auth.jwt() ->> 'iss') like 'https://securetoken.google.com/%'
    and (select auth.jwt() ->> 'sub') = uid
  );
