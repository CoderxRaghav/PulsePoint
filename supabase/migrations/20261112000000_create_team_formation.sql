create table if not exists public.teams (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  team_name text not null check (char_length(btrim(team_name)) between 2 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  leader_uid text not null,
  college text not null check (char_length(btrim(college)) between 2 and 160),
  max_members integer not null check (max_members between 2 and 50),
  member_count integer not null default 1 check (member_count between 1 and max_members),
  positions_open integer not null default 0
    check (positions_open between 0 and max_members - member_count),
  recruitment_status text not null default 'open'
    check (recruitment_status in ('open', 'closed')),
  experience_level text not null default 'Any'
    check (experience_level in ('Any', 'Beginner', 'Intermediate', 'Advanced')),
  beginner_friendly boolean not null default false,
  collaboration_preferences text[] not null default '{}',
  hackathon_name text,
  logo_url text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  archived_at timestamptz
);

create table if not exists public.projects (
  team_id uuid primary key references public.teams(id) on delete cascade,
  project_name text not null check (char_length(btrim(project_name)) between 2 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 3000),
  problem_statement text not null check (char_length(btrim(problem_statement)) between 10 and 3000),
  objectives text[] not null default '{}',
  domain text not null check (char_length(btrim(domain)) between 2 and 100),
  category text not null check (char_length(btrim(category)) between 2 and 100),
  development_stage text not null
    check (development_stage in ('Idea', 'Research', 'Design', 'Prototype', 'Development', 'Launched')),
  technologies text[] not null default '{}',
  github_url text,
  demo_url text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.team_members (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_uid text not null,
  role text not null default 'Member' check (char_length(btrim(role)) between 1 and 80),
  joined_at timestamptz not null default pg_catalog.now(),
  unique (team_id, user_uid)
);

create table if not exists public.team_required_skills (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  skill_name text not null check (char_length(btrim(skill_name)) between 1 and 80),
  positions_required integer not null default 1 check (positions_required between 1 and 50),
  preferred_role text not null check (char_length(btrim(preferred_role)) between 1 and 80),
  unique (team_id, skill_name)
);

create table if not exists public.team_join_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  applicant_uid text not null,
  message text not null default '' check (char_length(message) <= 1200),
  preferred_role text not null default 'Member'
    check (char_length(btrim(preferred_role)) between 1 and 80),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create unique index if not exists idx_team_join_requests_one_pending
  on public.team_join_requests (team_id, applicant_uid)
  where status = 'pending';
create index if not exists idx_teams_discovery
  on public.teams (recruitment_status, archived_at, created_at desc);
create index if not exists idx_teams_college on public.teams (college);
create index if not exists idx_teams_leader on public.teams (leader_uid);
create index if not exists idx_projects_domain on public.projects (domain);
create index if not exists idx_projects_technologies on public.projects using gin (technologies);
create index if not exists idx_team_members_user on public.team_members (user_uid);
create index if not exists idx_team_required_skills_team on public.team_required_skills (team_id);
create index if not exists idx_team_join_requests_team_status
  on public.team_join_requests (team_id, status, created_at desc);
create index if not exists idx_team_join_requests_applicant
  on public.team_join_requests (applicant_uid, created_at desc);

create or replace function public.set_team_formation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
  before update on public.teams
  for each row execute function public.set_team_formation_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_team_formation_updated_at();

drop trigger if exists set_team_join_requests_updated_at on public.team_join_requests;
create trigger set_team_join_requests_updated_at
  before update on public.team_join_requests
  for each row execute function public.set_team_formation_updated_at();

create or replace function public.create_team_with_project(
  p_leader_uid text,
  p_team jsonb,
  p_project jsonb,
  p_required_skills jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if p_leader_uid is null or pg_catalog.btrim(p_leader_uid) = '' then
    raise exception using errcode = '22023', message = 'A verified team leader is required.';
  end if;

  insert into public.teams (
    team_name, description, leader_uid, college, max_members, member_count,
    positions_open, recruitment_status, experience_level, beginner_friendly,
    collaboration_preferences, hackathon_name, logo_url
  )
  values (
    p_team->>'team_name', p_team->>'description', p_leader_uid, p_team->>'college',
    (p_team->>'max_members')::integer, 1, (p_team->>'positions_open')::integer,
    coalesce(p_team->>'recruitment_status', 'open'),
    coalesce(p_team->>'experience_level', 'Any'),
    coalesce((p_team->>'beginner_friendly')::boolean, false),
    array(select pg_catalog.jsonb_array_elements_text(coalesce(p_team->'collaboration_preferences', '[]'::jsonb))),
    nullif(pg_catalog.btrim(p_team->>'hackathon_name'), ''),
    nullif(pg_catalog.btrim(p_team->>'logo_url'), '')
  )
  returning id into v_team_id;

  insert into public.team_members (team_id, user_uid, role)
  values (v_team_id, p_leader_uid, 'Team Lead');

  insert into public.projects (
    team_id, project_name, description, problem_statement, objectives,
    domain, category, development_stage, technologies, github_url, demo_url
  )
  values (
    v_team_id, p_project->>'project_name', p_project->>'description',
    p_project->>'problem_statement',
    array(select pg_catalog.jsonb_array_elements_text(coalesce(p_project->'objectives', '[]'::jsonb))),
    p_project->>'domain', p_project->>'category', p_project->>'development_stage',
    array(select pg_catalog.jsonb_array_elements_text(coalesce(p_project->'technologies', '[]'::jsonb))),
    nullif(pg_catalog.btrim(p_project->>'github_url'), ''),
    nullif(pg_catalog.btrim(p_project->>'demo_url'), '')
  );

  insert into public.team_required_skills (team_id, skill_name, positions_required, preferred_role)
  select v_team_id, skill.skill_name, skill.positions_required, skill.preferred_role
  from pg_catalog.jsonb_to_recordset(coalesce(p_required_skills, '[]'::jsonb))
    as skill(skill_name text, positions_required integer, preferred_role text);

  return v_team_id;
end;
$$;

create or replace function public.accept_team_join_request(
  p_actor_uid text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.team_join_requests%rowtype;
  v_team public.teams%rowtype;
  v_team_id uuid;
begin
  select team_id into v_team_id
  from public.team_join_requests
  where id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Join request not found.';
  end if;

  select * into v_team
  from public.teams
  where id = v_team_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Team not found.';
  end if;

  select * into v_request
  from public.team_join_requests
  where id = p_request_id and team_id = v_team_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Join request not found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'This request is no longer pending.';
  end if;

  if v_team.leader_uid <> p_actor_uid then
    raise exception using errcode = '42501', message = 'Only the team leader can review requests.';
  end if;
  if v_team.recruitment_status <> 'open' or v_team.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'This team is not accepting members.';
  end if;
  if v_team.member_count >= v_team.max_members or v_team.positions_open <= 0 then
    raise exception using errcode = 'P0001', message = 'This team has no available positions.';
  end if;
  if exists (
    select 1 from public.team_members
    where team_id = v_team.id and user_uid = v_request.applicant_uid
  ) then
    raise exception using errcode = 'P0001', message = 'The applicant is already a team member.';
  end if;

  insert into public.team_members (team_id, user_uid, role)
  values (v_team.id, v_request.applicant_uid, v_request.preferred_role);

  update public.teams
  set member_count = member_count + 1,
      positions_open = positions_open - 1
  where id = v_team.id;

  update public.team_join_requests
  set status = 'accepted'
  where id = v_request.id;

  return pg_catalog.jsonb_build_object(
    'team_id', v_team.id,
    'member_count', v_team.member_count + 1,
    'positions_open', v_team.positions_open - 1
  );
end;
$$;

create or replace function public.decide_team_join_request(
  p_actor_uid text,
  p_request_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.team_join_requests%rowtype;
  v_team_id uuid;
  v_team public.teams%rowtype;
begin
  if p_status not in ('rejected', 'withdrawn') then
    raise exception using errcode = '22023', message = 'Invalid request status.';
  end if;

  select team_id into v_team_id
  from public.team_join_requests
  where id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Join request not found.';
  end if;

  if p_status = 'rejected' then
    select * into v_team
    from public.teams
    where id = v_team_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Team not found.';
    end if;
    if v_team.leader_uid <> p_actor_uid then
      raise exception using errcode = '42501', message = 'Only the team leader can review requests.';
    end if;
  end if;

  select * into v_request
  from public.team_join_requests
  where id = p_request_id and team_id = v_team_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Join request not found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'This request is no longer pending.';
  end if;

  if p_status = 'withdrawn' then
    if v_request.applicant_uid <> p_actor_uid then
      raise exception using errcode = '42501', message = 'You can only withdraw your own request.';
    end if;
  end if;

  update public.team_join_requests
  set status = p_status
  where id = v_request.id;
end;
$$;

create or replace function public.remove_team_member(
  p_actor_uid text,
  p_team_id uuid,
  p_user_uid text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_is_leader boolean;
begin
  select * into v_team
  from public.teams
  where id = p_team_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Team not found.';
  end if;
  if v_team.leader_uid = p_user_uid then
    raise exception using errcode = 'P0001', message = 'Transfer leadership before leaving or removing the team leader.';
  end if;

  v_is_leader := v_team.leader_uid = p_actor_uid;
  if not v_is_leader and p_actor_uid <> p_user_uid then
    raise exception using errcode = '42501', message = 'You cannot remove this team member.';
  end if;

  delete from public.team_members
  where team_id = p_team_id and user_uid = p_user_uid;
  if not found then
    raise exception using errcode = 'P0002', message = 'Team member not found.';
  end if;

  update public.teams
  set member_count = member_count - 1,
      positions_open = case
        when recruitment_status = 'open' then least(positions_open + 1, max_members - (member_count - 1))
        else positions_open
      end
  where id = p_team_id;

  return pg_catalog.jsonb_build_object(
    'member_count', v_team.member_count - 1,
    'positions_open', case
      when v_team.recruitment_status = 'open' then least(v_team.positions_open + 1, v_team.max_members - (v_team.member_count - 1))
      else v_team.positions_open
    end
  );
end;
$$;

create or replace function public.transfer_team_leadership(
  p_actor_uid text,
  p_team_id uuid,
  p_new_leader_uid text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
begin
  select * into v_team
  from public.teams
  where id = p_team_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Team not found.';
  end if;
  if v_team.leader_uid <> p_actor_uid then
    raise exception using errcode = '42501', message = 'Only the current leader can transfer leadership.';
  end if;
  if p_actor_uid = p_new_leader_uid then
    raise exception using errcode = '22023', message = 'Choose a different team member.';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_uid = p_new_leader_uid
  ) then
    raise exception using errcode = 'P0001', message = 'Leadership can only be transferred to a current member.';
  end if;

  update public.team_members
  set role = 'Member'
  where team_id = p_team_id and user_uid = p_actor_uid;
  update public.team_members
  set role = 'Team Lead'
  where team_id = p_team_id and user_uid = p_new_leader_uid;
  update public.teams
  set leader_uid = p_new_leader_uid
  where id = p_team_id;
end;
$$;

create or replace function public.create_team_join_request(
  p_actor_uid text,
  p_team_id uuid,
  p_message text,
  p_preferred_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_request_id uuid;
begin
  select * into v_team
  from public.teams
  where id = p_team_id
  for update;
  if not found or v_team.archived_at is not null then
    raise exception using errcode = 'P0002', message = 'Team not found.';
  end if;
  if v_team.leader_uid = p_actor_uid then
    raise exception using errcode = 'P0001', message = 'Team leaders cannot request to join their own team.';
  end if;
  if v_team.recruitment_status <> 'open' or
     v_team.member_count >= v_team.max_members or
     v_team.positions_open <= 0 then
    raise exception using errcode = 'P0001', message = 'This team is not accepting join requests.';
  end if;
  if exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_uid = p_actor_uid
  ) then
    raise exception using errcode = 'P0001', message = 'You are already a team member.';
  end if;

  insert into public.team_join_requests (team_id, applicant_uid, message, preferred_role)
  values (p_team_id, p_actor_uid, p_message, p_preferred_role)
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.update_team_with_project(
  p_actor_uid text,
  p_team_id uuid,
  p_team jsonb,
  p_project jsonb,
  p_required_skills jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
begin
  select * into v_team
  from public.teams
  where id = p_team_id and archived_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Team not found.';
  end if;
  if v_team.leader_uid <> p_actor_uid then
    raise exception using errcode = '42501', message = 'Only the team leader can edit this team.';
  end if;
  if v_team.member_count > (p_team->>'max_members')::integer or
     (p_team->>'positions_open')::integer >
       (p_team->>'max_members')::integer - v_team.member_count then
    raise exception using errcode = 'P0001', message = 'Team size and available positions cannot be lower than current membership.';
  end if;

  update public.teams
  set team_name = p_team->>'team_name',
      description = p_team->>'description',
      college = p_team->>'college',
      max_members = (p_team->>'max_members')::integer,
      positions_open = (p_team->>'positions_open')::integer,
      recruitment_status = p_team->>'recruitment_status',
      experience_level = p_team->>'experience_level',
      beginner_friendly = (p_team->>'beginner_friendly')::boolean,
      collaboration_preferences = array(
        select pg_catalog.jsonb_array_elements_text(coalesce(p_team->'collaboration_preferences', '[]'::jsonb))
      ),
      hackathon_name = nullif(pg_catalog.btrim(p_team->>'hackathon_name'), ''),
      logo_url = nullif(pg_catalog.btrim(p_team->>'logo_url'), '')
  where id = p_team_id;

  update public.projects
  set project_name = p_project->>'project_name',
      description = p_project->>'description',
      problem_statement = p_project->>'problem_statement',
      objectives = array(
        select pg_catalog.jsonb_array_elements_text(coalesce(p_project->'objectives', '[]'::jsonb))
      ),
      domain = p_project->>'domain',
      category = p_project->>'category',
      development_stage = p_project->>'development_stage',
      technologies = array(
        select pg_catalog.jsonb_array_elements_text(coalesce(p_project->'technologies', '[]'::jsonb))
      ),
      github_url = nullif(pg_catalog.btrim(p_project->>'github_url'), ''),
      demo_url = nullif(pg_catalog.btrim(p_project->>'demo_url'), '')
  where team_id = p_team_id;

  delete from public.team_required_skills where team_id = p_team_id;
  insert into public.team_required_skills (team_id, skill_name, positions_required, preferred_role)
  select p_team_id, skill.skill_name, skill.positions_required, skill.preferred_role
  from pg_catalog.jsonb_to_recordset(coalesce(p_required_skills, '[]'::jsonb))
    as skill(skill_name text, positions_required integer, preferred_role text);
end;
$$;

alter table public.teams enable row level security;
alter table public.projects enable row level security;
alter table public.team_members enable row level security;
alter table public.team_required_skills enable row level security;
alter table public.team_join_requests enable row level security;

revoke all on table public.teams, public.projects, public.team_members,
  public.team_required_skills, public.team_join_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.teams, public.projects,
  public.team_members, public.team_required_skills, public.team_join_requests to service_role;

revoke all on function public.create_team_with_project(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.accept_team_join_request(text, uuid) from public, anon, authenticated;
revoke all on function public.decide_team_join_request(text, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_team_member(text, uuid, text) from public, anon, authenticated;
revoke all on function public.transfer_team_leadership(text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_team_join_request(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_team_with_project(text, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_team_with_project(text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.accept_team_join_request(text, uuid) to service_role;
grant execute on function public.decide_team_join_request(text, uuid, text) to service_role;
grant execute on function public.remove_team_member(text, uuid, text) to service_role;
grant execute on function public.transfer_team_leadership(text, uuid, text) to service_role;
grant execute on function public.create_team_join_request(text, uuid, text, text) to service_role;
grant execute on function public.update_team_with_project(text, uuid, jsonb, jsonb, jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
