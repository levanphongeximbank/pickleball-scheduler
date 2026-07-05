-- Phase 23C — Team Tournament Cloud Sync (RPC + RLS)
-- Idempotent migration. Chạy SAU:
--   supabase-multi-tenant-sprint2.sql
--   supabase-identity-v40-phaseC.sql (user_has_permission)
--   docs/v5/PHASE_23_TEAM_TOURNAMENT.sql (optional — bảng cơ sở)
--
-- Mục tiêu: multi-user cloud persistence cho giải đồng đội qua RPC security definer.

-- ─── Permissions (additive, idempotent) ─────────────────────────
insert into public.permissions (id, module, action, description)
values
  ('team.manage', 'team', 'manage', 'Quản lý đội giải đồng đội'),
  ('team.view', 'team', 'view', 'Xem đội giải đồng đội'),
  ('team.lineup.submit', 'team', 'lineup_submit', 'Đội trưởng nộp đội hình'),
  ('team.lineup.lock', 'team', 'lineup_lock', 'Khóa đội hình'),
  ('team.lineup.publish', 'team', 'lineup_publish', 'Công bố đội hình'),
  ('team.lineup.randomize', 'team', 'lineup_randomize', 'Random đội hình khi quá hạn'),
  ('team.match.result.manage', 'team', 'match_result_manage', 'Nhập kết quả trận đồng đội'),
  ('team.standings.view', 'team', 'standings_view', 'Xem BXH đồng đội')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- ─── role_permissions (mirror rolePermissions.js — sau permissions) ─
insert into public.role_permissions (role_id, permission_id)
select 'SUPER_ADMIN', p.id
from public.permissions p
where p.id like 'team.%'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.role_id, p.id
from (values ('COURT_OWNER'), ('COURT_MANAGER')) as r(role_id)
cross join public.permissions p
where p.id in (
  'team.manage', 'team.view', 'team.lineup.lock', 'team.lineup.publish',
  'team.lineup.randomize', 'team.match.result.manage', 'team.standings.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select
  case rp.role_id
    when 'COURT_OWNER' then 'VENUE_OWNER'
    when 'COURT_MANAGER' then 'VENUE_MANAGER'
  end,
  rp.permission_id
from public.role_permissions rp
where rp.role_id in ('COURT_OWNER', 'COURT_MANAGER')
  and rp.permission_id like 'team.%'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
values
  ('REFEREE', 'team.match.result.manage'),
  ('REFEREE', 'team.standings.view'),
  ('PLAYER', 'team.view'),
  ('PLAYER', 'team.lineup.submit'),
  ('PLAYER', 'team.standings.view')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'CLUB_OWNER', p.id
from public.permissions p
where p.id in (
  'team.manage', 'team.view', 'team.lineup.lock', 'team.lineup.publish',
  'team.lineup.randomize', 'team.match.result.manage', 'team.standings.view'
)
on conflict do nothing;

-- ─── Core tournament header ───────────────────────────────────────
create table if not exists public.team_tournaments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  club_id text not null,
  tournament_id text not null,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','registration','ready','active','completed','cancelled')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (tenant_id, club_id, tournament_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournaments_tenant_id_fkey'
  ) then
    alter table public.team_tournaments
      add constraint team_tournaments_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

create index if not exists idx_team_tournaments_tenant
  on public.team_tournaments (tenant_id, created_at desc);

-- ─── Teams ────────────────────────────────────────────────────────
create table if not exists public.team_tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_team_id text not null,
  name text not null,
  color text,
  logo_url text,
  captain_player_id text,
  deputy_player_ids text[] not null default '{}',
  absent_player_ids text[] not null default '{}',
  locked_player_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (team_tournament_id, external_team_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_teams_tenant_id_fkey'
  ) then
    alter table public.team_tournament_teams
      add constraint team_tournament_teams_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

create index if not exists idx_team_tournament_teams_tenant
  on public.team_tournament_teams (tenant_id, tournament_id);

-- ─── Team members (normalized roster) ─────────────────────────────
create table if not exists public.team_tournament_team_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_id uuid not null references public.team_tournament_teams(id) on delete cascade,
  player_id text not null,
  role text not null default 'member'
    check (role in ('member','captain','deputy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (team_id, player_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_team_members_tenant_id_fkey'
  ) then
    alter table public.team_tournament_team_members
      add constraint team_tournament_team_members_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

create index if not exists idx_team_tournament_team_members_player
  on public.team_tournament_team_members (tenant_id, tournament_id, player_id);

-- ─── Disciplines ──────────────────────────────────────────────────
create table if not exists public.team_tournament_disciplines (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_discipline_id text not null,
  name text not null,
  category_type text not null check (category_type in ('singles','doubles','mixed')),
  gender_requirement text not null default 'any'
    check (gender_requirement in ('male','female','any','mixed_pair')),
  player_count int not null default 2 check (player_count > 0),
  sort_order int not null default 1,
  scoring_format jsonb not null default '{}'::jsonb,
  counts_toward_result boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_tournament_id, external_discipline_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_disciplines_tenant_id_fkey'
  ) then
    alter table public.team_tournament_disciplines
      add constraint team_tournament_disciplines_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

-- ─── Matchups ─────────────────────────────────────────────────────
create table if not exists public.team_tournament_matchups (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_matchup_id text not null,
  team_a_id text not null,
  team_b_id text not null,
  scheduled_at timestamptz,
  lineup_lock_at timestamptz,
  court_label text,
  status text not null default 'lineup_open'
    check (status in ('scheduled','lineup_open','locked','published','in_progress','completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (team_tournament_id, external_matchup_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_matchups_tenant_id_fkey'
  ) then
    alter table public.team_tournament_matchups
      add constraint team_tournament_matchups_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

create index if not exists idx_team_tournament_matchups_tenant
  on public.team_tournament_matchups (tenant_id, tournament_id, status);

-- ─── Lineups ──────────────────────────────────────────────────────
create table if not exists public.team_tournament_lineups (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  matchup_id uuid not null references public.team_tournament_matchups(id) on delete cascade,
  team_external_id text not null,
  status text not null default 'not_submitted'
    check (status in ('not_submitted','draft','submitted','locked','published')),
  selections jsonb not null default '{}'::jsonb,
  source text not null default 'captain'
    check (source in ('captain','random','btc_override')),
  audit_note text,
  submitted_at timestamptz,
  locked_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (matchup_id, team_external_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_lineups_tenant_id_fkey'
  ) then
    alter table public.team_tournament_lineups
      add constraint team_tournament_lineups_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

-- ─── Lineup entries (normalized selections) ───────────────────────
create table if not exists public.team_tournament_lineup_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  lineup_id uuid not null references public.team_tournament_lineups(id) on delete cascade,
  discipline_external_id text not null,
  player_id text not null,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  unique (lineup_id, discipline_external_id, player_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_lineup_entries_tenant_id_fkey'
  ) then
    alter table public.team_tournament_lineup_entries
      add constraint team_tournament_lineup_entries_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

-- ─── Sub-matches ──────────────────────────────────────────────────
create table if not exists public.team_tournament_sub_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  matchup_id uuid not null references public.team_tournament_matchups(id) on delete cascade,
  external_sub_match_id text not null,
  discipline_external_id text not null,
  sort_order int not null default 1,
  status text not null default 'waiting'
    check (status in ('waiting','playing','completed','forfeit')),
  score jsonb not null default '{"teamA":0,"teamB":0,"games":[]}'::jsonb,
  winner_team_id text,
  result_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (matchup_id, external_sub_match_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_sub_matches_tenant_id_fkey'
  ) then
    alter table public.team_tournament_sub_matches
      add constraint team_tournament_sub_matches_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

-- ─── Standings cache ──────────────────────────────────────────────
create table if not exists public.team_tournament_standings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  team_external_id text not null,
  rank int not null default 0,
  played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  sub_match_wins int not null default 0,
  sub_match_losses int not null default 0,
  sub_match_diff int not null default 0,
  points_scored int not null default 0,
  points_conceded int not null default 0,
  ranking_points int not null default 0,
  computed_at timestamptz not null default now(),
  unique (team_tournament_id, team_external_id)
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_standings_tenant_id_fkey'
  ) then
    alter table public.team_tournament_standings
      add constraint team_tournament_standings_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

-- ─── Team tournament audit logs ───────────────────────────────────
create table if not exists public.team_tournament_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null default 'team_tournament',
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $fk$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_audit_logs_tenant_id_fkey'
  ) then
    alter table public.team_tournament_audit_logs
      add constraint team_tournament_audit_logs_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

create index if not exists idx_team_tournament_audit_logs_tenant
  on public.team_tournament_audit_logs (tenant_id, tournament_id, created_at desc);

-- ─── Internal helpers ─────────────────────────────────────────────
create or replace function public.team_tournament_user_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.player_id), ''), '')
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.team_tournament_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.user_has_permission('team.manage')
    or public.user_has_permission('tournament.update');
$$;

create or replace function public.team_tournament_can_manage_results()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.user_has_permission('team.match.result.manage')
    or public.user_has_permission('match.update')
    or public.user_has_permission('tournament.update');
$$;

create or replace function public.team_tournament_assert_tenant(p_tenant_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_tenant text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if public.is_super_admin() then
    return;
  end if;

  v_user_tenant := public.user_venue_id();
  if v_user_tenant is null or v_user_tenant <> p_tenant_id then
    raise exception 'access_denied: cross-tenant';
  end if;
end;
$$;

create or replace function public.team_tournament_is_captain(
  p_team_tournament_id uuid,
  p_team_external_id text,
  p_player_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_tournament_teams t
    join public.team_tournament_team_members m on m.team_id = t.id
    where t.team_tournament_id = p_team_tournament_id
      and t.external_team_id = p_team_external_id
      and m.player_id = p_player_id
      and m.role in ('captain', 'deputy')
  )
  or exists (
    select 1
    from public.team_tournament_teams t
    where t.team_tournament_id = p_team_tournament_id
      and t.external_team_id = p_team_external_id
      and (
        t.captain_player_id = p_player_id
        or p_player_id = any(t.deputy_player_ids)
      )
  );
$$;

create or replace function public.team_tournament_write_audit(
  p_tenant_id text,
  p_tournament_id text,
  p_action text,
  p_resource_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_tournament_audit_logs (
    tenant_id, tournament_id, actor_id, action, resource_id, metadata
  ) values (
    p_tenant_id, p_tournament_id, auth.uid(), p_action, p_resource_id, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.team_tournament_resolve_header(p_tournament_id text)
returns public.team_tournaments
language sql
stable
security definer
set search_path = public
as $$
  select tt.*
  from public.team_tournaments tt
  where tt.tournament_id = p_tournament_id
  limit 1;
$$;

-- Sync lineup_entries from selections jsonb
create or replace function public.team_tournament_sync_lineup_entries(
  p_lineup_id uuid,
  p_tenant_id text,
  p_tournament_id text,
  p_selections jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline text;
  v_players jsonb;
  v_player text;
  v_order int;
begin
  delete from public.team_tournament_lineup_entries where lineup_id = p_lineup_id;

  for v_discipline, v_players in
    select key, value from jsonb_each(coalesce(p_selections, '{}'::jsonb))
  loop
    v_order := 0;
    for v_player in
      select jsonb_array_elements_text(v_players)
    loop
      v_order := v_order + 1;
      insert into public.team_tournament_lineup_entries (
        tenant_id, tournament_id, lineup_id, discipline_external_id, player_id, sort_order
      ) values (
        p_tenant_id, p_tournament_id, p_lineup_id, v_discipline, v_player, v_order
      );
    end loop;
  end loop;
end;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────
alter table public.team_tournaments enable row level security;
alter table public.team_tournament_teams enable row level security;
alter table public.team_tournament_team_members enable row level security;
alter table public.team_tournament_disciplines enable row level security;
alter table public.team_tournament_matchups enable row level security;
alter table public.team_tournament_lineups enable row level security;
alter table public.team_tournament_lineup_entries enable row level security;
alter table public.team_tournament_sub_matches enable row level security;
alter table public.team_tournament_standings enable row level security;
alter table public.team_tournament_audit_logs enable row level security;

-- Tenant isolation: read for same venue; write via RPC (security definer) primarily
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'team_tournaments',
    'team_tournament_teams',
    'team_tournament_team_members',
    'team_tournament_disciplines',
    'team_tournament_matchups',
    'team_tournament_lineups',
    'team_tournament_lineup_entries',
    'team_tournament_sub_matches',
    'team_tournament_standings',
    'team_tournament_audit_logs'
  ]
  loop
    execute format('drop policy if exists %I_tenant_select on public.%I', tbl, tbl);
    execute format(
      'create policy %I_tenant_select on public.%I for select to authenticated using (
         public.is_super_admin()
         or tenant_id = (select venue_id from public.profiles where id = auth.uid())
       )',
      tbl, tbl
    );

    execute format('drop policy if exists %I_tenant_write on public.%I', tbl, tbl);
    execute format(
      'create policy %I_tenant_write on public.%I for all to authenticated using (
         public.is_super_admin()
         or (
           tenant_id = (select venue_id from public.profiles where id = auth.uid())
           and public.team_tournament_can_manage()
         )
       ) with check (
         public.is_super_admin()
         or (
           tenant_id = (select venue_id from public.profiles where id = auth.uid())
           and public.team_tournament_can_manage()
         )
       )',
      tbl, tbl
    );
  end loop;
end $$;

-- ─── RPC: team_tournament_get_setup ───────────────────────────────
create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_player_id text;
  v_is_manage boolean;
  v_teams json;
  v_disciplines json;
  v_matchups json;
  v_lineups json;
  v_standings json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy giải.');
  end if;

  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_player_id := public.team_tournament_user_player_id();
  v_is_manage := public.team_tournament_can_manage();

  select coalesce(json_agg(json_build_object(
    'id', t.external_team_id,
    'name', t.name,
    'color', t.color,
    'logoUrl', t.logo_url,
    'captainPlayerId', t.captain_player_id,
    'deputyPlayerIds', t.deputy_player_ids,
    'playerIds', coalesce((
      select json_agg(m.player_id order by m.role desc, m.created_at)
      from public.team_tournament_team_members m where m.team_id = t.id
    ), '[]'::json),
    'absentPlayerIds', t.absent_player_ids,
    'lockedPlayerIds', t.locked_player_ids
  )), '[]'::json)
  into v_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id;

  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'categoryType', d.category_type,
    'genderRequirement', d.gender_requirement,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order,
    'scoringFormat', d.scoring_format,
    'countsTowardResult', d.counts_toward_result
  ) order by d.sort_order), '[]'::json)
  into v_disciplines
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select coalesce(json_agg(json_build_object(
    'id', m.external_matchup_id,
    'teamAId', m.team_a_id,
    'teamBId', m.team_b_id,
    'scheduledAt', m.scheduled_at,
    'lineupLockAt', m.lineup_lock_at,
    'courtLabel', m.court_label,
    'status', m.status,
    'result', m.result,
    'subMatches', coalesce((
      select json_agg(json_build_object(
        'id', sm.external_sub_match_id,
        'disciplineId', sm.discipline_external_id,
        'sortOrder', sm.sort_order,
        'status', sm.status,
        'score', sm.score,
        'winnerTeamId', sm.winner_team_id,
        'resultConfirmedAt', sm.result_confirmed_at
      ) order by sm.sort_order)
      from public.team_tournament_sub_matches sm
      where sm.matchup_id = m.id
    ), '[]'::json)
  )), '[]'::json)
  into v_matchups
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id;

  -- Lineups with opponent visibility rules
  select coalesce(json_object_agg(
    m.external_matchup_id || '::' || l.team_external_id,
    json_build_object(
      'matchupId', m.external_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(p_viewer_team_id, '') then l.selections
        when m.status in ('published','in_progress','completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'source', l.source,
      'auditNote', l.audit_note
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  join public.team_tournament_matchups m on m.id = l.matchup_id
  where m.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.view')
      or public.user_has_permission('team.standings.view')
      or public.team_tournament_can_manage_results()
      or l.team_external_id = coalesce(p_viewer_team_id, '')
      or m.status in ('published','in_progress','completed')
      or l.published_at is not null
    );

  select coalesce(json_agg(json_build_object(
    'teamId', s.team_external_id,
    'rank', s.rank,
    'played', s.played,
    'wins', s.wins,
    'losses', s.losses,
    'subMatchWins', s.sub_match_wins,
    'subMatchLosses', s.sub_match_losses,
    'subMatchDiff', s.sub_match_diff,
    'pointsScored', s.points_scored,
    'pointsConceded', s.points_conceded,
    'rankingPoints', s.ranking_points
  ) order by s.rank), '[]'::json)
  into v_standings
  from public.team_tournament_standings s
  where s.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.standings.view')
      or v_header.status in ('active','completed')
    );

  return json_build_object(
    'ok', true,
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'clubId', v_header.club_id,
      'tenantId', v_header.tenant_id,
      'name', v_header.name,
      'status', v_header.status,
      'settings', v_header.settings,
      'teamData', json_build_object(
        'disciplines', v_disciplines,
        'teams', v_teams,
        'matchups', v_matchups,
        'lineups', v_lineups,
        'standings', v_standings,
        'settings', v_header.settings
      )
    )
  );
end;
$$;

-- ─── RPC: team_tournament_save_team ───────────────────────────────
create or replace function public.team_tournament_save_team(
  p_tournament_id text,
  p_team jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_external_id text;
  v_team_id uuid;
  v_is_new boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_external_id := coalesce(p_team->>'id', p_team->>'externalTeamId');
  if v_external_id is null or v_external_id = '' then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu team id.');
  end if;

  select t.id into v_team_id
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id and t.external_team_id = v_external_id;

  if v_team_id is null then
    v_is_new := true;
    insert into public.team_tournament_teams (
      tenant_id, tournament_id, team_tournament_id, external_team_id,
      name, color, logo_url, captain_player_id, deputy_player_ids,
      absent_player_ids, locked_player_ids, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_header.id, v_external_id,
      coalesce(p_team->>'name', 'Đội mới'),
      p_team->>'color', p_team->>'logoUrl',
      p_team->>'captainPlayerId',
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_team->'deputyPlayerIds','[]'::jsonb)) x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_team->'absentPlayerIds','[]'::jsonb)) x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_team->'lockedPlayerIds','[]'::jsonb)) x), '{}'),
      auth.uid(), auth.uid()
    ) returning id into v_team_id;
  else
    update public.team_tournament_teams set
      name = coalesce(p_team->>'name', name),
      color = coalesce(p_team->>'color', color),
      logo_url = coalesce(p_team->>'logoUrl', logo_url),
      captain_player_id = coalesce(p_team->>'captainPlayerId', captain_player_id),
      deputy_player_ids = coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(p_team->'deputyPlayerIds','[]'::jsonb)) x),
        deputy_player_ids
      ),
      absent_player_ids = coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(p_team->'absentPlayerIds','[]'::jsonb)) x),
        absent_player_ids
      ),
      locked_player_ids = coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(p_team->'lockedPlayerIds','[]'::jsonb)) x),
        locked_player_ids
      ),
      updated_at = now(),
      updated_by = auth.uid()
    where id = v_team_id;
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    case when v_is_new then 'team.create' else 'team.update' end,
    v_external_id, p_team
  );

  return json_build_object('ok', true, 'teamId', v_external_id);
end;
$$;

-- ─── RPC: assign / remove member / set captain ────────────────────
create or replace function public.team_tournament_assign_member(
  p_tournament_id text,
  p_team_id text,
  p_player_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_team_row public.team_tournament_teams;
  v_allow_cross boolean;
  v_existing_team text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_team_row
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id and t.external_team_id = p_team_id;

  if v_team_row.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy đội.');
  end if;

  v_allow_cross := coalesce((v_header.settings->>'allowPlayerCrossTeam')::boolean, false);
  if not v_allow_cross then
    select t.external_team_id into v_existing_team
    from public.team_tournament_team_members m
    join public.team_tournament_teams t on t.id = m.team_id
    where m.tenant_id = v_header.tenant_id
      and m.tournament_id = v_header.tournament_id
      and m.player_id = p_player_id
      and t.external_team_id <> p_team_id
    limit 1;

    if v_existing_team is not null then
      return json_build_object('ok', false, 'code', 'VALIDATION',
        'error', 'VĐV đã thuộc đội khác trong giải.');
    end if;
  end if;

  insert into public.team_tournament_team_members (
    tenant_id, tournament_id, team_id, player_id, role, created_by
  ) values (
    v_header.tenant_id, v_header.tournament_id, v_team_row.id, p_player_id, 'member', auth.uid()
  )
  on conflict (team_id, player_id) do nothing;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.player_add', p_team_id,
    jsonb_build_object('playerId', p_player_id)
  );

  return json_build_object('ok', true, 'playerId', p_player_id);
end;
$$;

create or replace function public.team_tournament_remove_member(
  p_tournament_id text,
  p_team_id text,
  p_player_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_team_row public.team_tournament_teams;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_team_row
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id and t.external_team_id = p_team_id;

  if v_team_row.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_team_row.captain_player_id = p_player_id then
    return json_build_object('ok', false, 'code', 'VALIDATION',
      'error', 'Không thể xóa đội trưởng.');
  end if;

  delete from public.team_tournament_team_members
  where team_id = v_team_row.id and player_id = p_player_id;

  update public.team_tournament_teams set
    deputy_player_ids = array_remove(deputy_player_ids, p_player_id),
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_team_row.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.player_remove', p_team_id,
    jsonb_build_object('playerId', p_player_id)
  );

  return json_build_object('ok', true, 'playerId', p_player_id);
end;
$$;

create or replace function public.team_tournament_set_captain(
  p_tournament_id text,
  p_team_id text,
  p_player_id text,
  p_deputy_ids text[] default '{}'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_team_row public.team_tournament_teams;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_team_row
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id and t.external_team_id = p_team_id;

  if v_team_row.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not exists (
    select 1 from public.team_tournament_team_members
    where team_id = v_team_row.id and player_id = p_player_id
  ) then
    return json_build_object('ok', false, 'code', 'VALIDATION',
      'error', 'Đội trưởng phải là thành viên đội.');
  end if;

  update public.team_tournament_team_members set role = 'member'
  where team_id = v_team_row.id and role in ('captain','deputy');

  update public.team_tournament_team_members set role = 'captain'
  where team_id = v_team_row.id and player_id = p_player_id;

  update public.team_tournament_team_members set role = 'deputy'
  where team_id = v_team_row.id and player_id = any(p_deputy_ids);

  update public.team_tournament_teams set
    captain_player_id = p_player_id,
    deputy_player_ids = coalesce(p_deputy_ids, '{}'),
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_team_row.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.captain_assign', p_team_id,
    jsonb_build_object('playerId', p_player_id, 'deputyIds', p_deputy_ids)
  );

  return json_build_object('ok', true, 'playerId', p_player_id);
end;
$$;

-- ─── RPC: lineup draft / submit ───────────────────────────────────
create or replace function public.team_tournament_save_lineup_draft(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lineup_id uuid;
  v_player_id text;
  v_can_manage boolean;
  v_discipline record;
  v_count int;
  v_member_count int;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_player_id := public.team_tournament_user_player_id();
  v_can_manage := public.team_tournament_can_manage();

  if not v_can_manage
    and not (
      public.user_has_permission('team.lineup.submit')
      and public.team_tournament_is_captain(v_header.id, p_team_id, v_player_id)
    ) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  if v_matchup.lineup_lock_at is not null and now() >= v_matchup.lineup_lock_at then
    return json_build_object('ok', false, 'code', 'LOCKED', 'error', 'Đã quá giờ khóa đội hình.');
  end if;

  -- Validate selections: player membership + discipline counts
  for v_discipline in
    select * from public.team_tournament_disciplines
    where team_tournament_id = v_header.id
  loop
    v_count := coalesce(jsonb_array_length(p_selections->v_discipline.external_discipline_id), 0);
    if v_count > 0 and v_count <> v_discipline.player_count then
      return json_build_object('ok', false, 'code', 'VALIDATION',
        'error', format('%s cần %s VĐV.', v_discipline.name, v_discipline.player_count));
    end if;

    select count(*) into v_member_count
    from jsonb_array_elements_text(coalesce(p_selections->v_discipline.external_discipline_id, '[]'::jsonb)) pid
    where not exists (
      select 1 from public.team_tournament_team_members m
      join public.team_tournament_teams t on t.id = m.team_id
      where t.team_tournament_id = v_header.id
        and t.external_team_id = p_team_id
        and m.player_id = pid
    );

    if v_member_count > 0 then
      return json_build_object('ok', false, 'code', 'VALIDATION',
        'error', 'Có VĐV không thuộc đội.');
    end if;
  end loop;

  select l.id into v_lineup_id
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  if v_lineup_id is null then
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id,
      status, selections, source, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, p_team_id,
      'draft', coalesce(p_selections, '{}'::jsonb), 'captain', auth.uid(), auth.uid()
    ) returning id into v_lineup_id;
  else
    if exists (
      select 1 from public.team_tournament_lineups
      where id = v_lineup_id and locked_at is not null
    ) then
      return json_build_object('ok', false, 'code', 'LOCKED', 'error', 'Đội hình đã khóa.');
    end if;

    update public.team_tournament_lineups set
      status = 'draft',
      selections = coalesce(p_selections, '{}'::jsonb),
      updated_at = now(),
      updated_by = auth.uid()
    where id = v_lineup_id;
  end if;

  perform public.team_tournament_sync_lineup_entries(
    v_lineup_id, v_header.tenant_id, v_header.tournament_id, p_selections
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.lineup.draft', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'selections', p_selections)
  );

  return json_build_object('ok', true, 'lineupId', v_lineup_id);
end;
$$;

create or replace function public.team_tournament_submit_lineup(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft json;
begin
  v_draft := public.team_tournament_save_lineup_draft(
    p_tournament_id, p_matchup_id, p_team_id, p_selections
  );

  if not (v_draft->>'ok')::boolean then
    return v_draft;
  end if;

  update public.team_tournament_lineups l
  set status = 'submitted', submitted_at = now(), updated_at = now(), updated_by = auth.uid()
  from public.team_tournament_matchups m
  join public.team_tournaments tt on tt.id = m.team_tournament_id
  where l.matchup_id = m.id
    and l.team_external_id = p_team_id
    and m.external_matchup_id = p_matchup_id
    and tt.tournament_id = p_tournament_id;

  perform public.team_tournament_write_audit(
    (select tenant_id from public.team_tournaments where tournament_id = p_tournament_id limit 1),
    p_tournament_id, 'team.lineup.submit', p_matchup_id,
    jsonb_build_object('teamId', p_team_id)
  );

  return json_build_object('ok', true);
end;
$$;

-- ─── RPC: lock / publish matchup ──────────────────────────────────
create or replace function public.team_tournament_lock_matchup(
  p_tournament_id text,
  p_matchup_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lock_time timestamptz := now();
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not (
    public.team_tournament_can_manage()
    or public.user_has_permission('team.lineup.lock')
  ) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  update public.team_tournament_lineups set
    status = 'locked', locked_at = v_lock_time, updated_at = v_lock_time, updated_by = auth.uid()
  where matchup_id = v_matchup.id and status in ('submitted','draft','not_submitted');

  update public.team_tournament_matchups set
    status = 'locked', updated_at = v_lock_time, updated_by = auth.uid()
  where id = v_matchup.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.lineup.lock', p_matchup_id, '{}'::jsonb
  );

  return json_build_object('ok', true, 'lockedAt', v_lock_time);
end;
$$;

create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_publish_time timestamptz := now();
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not (
    public.team_tournament_can_manage()
    or public.user_has_permission('team.lineup.publish')
  ) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_matchup.status not in ('locked','published','in_progress','completed') then
    return json_build_object('ok', false, 'code', 'VALIDATION',
      'error', 'Matchup chưa khóa đội hình.');
  end if;

  update public.team_tournament_lineups set
    status = 'published', published_at = v_publish_time, updated_at = v_publish_time, updated_by = auth.uid()
  where matchup_id = v_matchup.id;

  update public.team_tournament_matchups set
    status = 'published', updated_at = v_publish_time, updated_by = auth.uid()
  where id = v_matchup.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.lineup.publish', p_matchup_id, '{}'::jsonb
  );

  return json_build_object('ok', true, 'publishedAt', v_publish_time);
end;
$$;

-- ─── RPC: sub-match result draft / confirm ────────────────────────
create or replace function public.team_tournament_save_sub_match_draft(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_matchup.status not in ('published','in_progress','completed') then
    return json_build_object('ok', false, 'code', 'VALIDATION',
      'error', 'Matchup chưa công bố.');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_sub_match.result_confirmed_at is not null and not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'LOCKED',
      'error', 'Kết quả đã xác nhận, chỉ BTC được sửa.');
  end if;

  update public.team_tournament_sub_matches set
    score = coalesce(p_score, score),
    status = 'playing',
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_sub_match.id;

  update public.team_tournament_matchups set status = 'in_progress', updated_at = now()
  where id = v_matchup.id and status = 'published';

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.match.result.draft', p_sub_match_id,
    jsonb_build_object('matchupId', p_matchup_id, 'score', p_score)
  );

  return json_build_object('ok', true);
end;
$$;

create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_winner_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_team_a_wins int := 0;
  v_team_b_wins int := 0;
  v_confirm_time timestamptz := now();
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_matchup.status not in ('published','in_progress','completed') then
    return json_build_object('ok', false, 'code', 'VALIDATION',
      'error', 'Matchup chưa công bố.');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_sub_match.result_confirmed_at is not null and not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'LOCKED',
      'error', 'Kết quả đã xác nhận.');
  end if;

  update public.team_tournament_sub_matches set
    score = coalesce(p_score, score),
    status = 'completed',
    winner_team_id = coalesce(p_winner_team_id, winner_team_id),
    result_confirmed_at = v_confirm_time,
    updated_at = v_confirm_time,
    updated_by = auth.uid()
  where id = v_sub_match.id;

  select
    count(*) filter (where winner_team_id = v_matchup.team_a_id),
    count(*) filter (where winner_team_id = v_matchup.team_b_id)
  into v_team_a_wins, v_team_b_wins
  from public.team_tournament_sub_matches
  where matchup_id = v_matchup.id and status = 'completed';

  update public.team_tournament_matchups set
    result = jsonb_build_object(
      'teamAWins', v_team_a_wins,
      'teamBWins', v_team_b_wins,
      'teamAPoints', v_team_a_wins,
      'teamBPoints', v_team_b_wins,
      'winnerTeamId', case
        when v_team_a_wins > v_team_b_wins then v_matchup.team_a_id
        when v_team_b_wins > v_team_a_wins then v_matchup.team_b_id
        else ''
      end
    ),
    status = case
      when (select count(*) from public.team_tournament_sub_matches
            where matchup_id = v_matchup.id and status <> 'completed') = 0
      then 'completed'
      else 'in_progress'
    end,
    updated_at = v_confirm_time,
    updated_by = auth.uid()
  where id = v_matchup.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.match.result.confirm', p_sub_match_id,
    jsonb_build_object('matchupId', p_matchup_id, 'score', p_score, 'winnerTeamId', p_winner_team_id)
  );

  return json_build_object(
    'ok', true,
    'matchupResult', (select result from public.team_tournament_matchups where id = v_matchup.id)
  );
end;
$$;

-- ─── RPC: standings ───────────────────────────────────────────────
create or replace function public.team_tournament_get_standings(
  p_tournament_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_standings json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  if not (
    public.team_tournament_can_manage()
    or public.user_has_permission('team.standings.view')
    or v_header.status in ('active','completed')
  ) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(json_agg(json_build_object(
    'teamId', s.team_external_id,
    'rank', s.rank,
    'played', s.played,
    'wins', s.wins,
    'losses', s.losses,
    'subMatchWins', s.sub_match_wins,
    'subMatchLosses', s.sub_match_losses,
    'subMatchDiff', s.sub_match_diff,
    'pointsScored', s.points_scored,
    'pointsConceded', s.points_conceded,
    'rankingPoints', s.ranking_points
  ) order by s.rank), '[]'::json)
  into v_standings
  from public.team_tournament_standings s
  where s.team_tournament_id = v_header.id;

  return json_build_object('ok', true, 'standings', v_standings);
end;
$$;

-- ─── RPC: upsert standings cache (called from app after compute) ──
create or replace function public.team_tournament_upsert_standings(
  p_tournament_id text,
  p_standings jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_row jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  delete from public.team_tournament_standings where team_tournament_id = v_header.id;

  for v_row in select * from jsonb_array_elements(coalesce(p_standings, '[]'::jsonb))
  loop
    insert into public.team_tournament_standings (
      tenant_id, tournament_id, team_tournament_id, team_external_id,
      rank, played, wins, losses,
      sub_match_wins, sub_match_losses, sub_match_diff,
      points_scored, points_conceded, ranking_points
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_header.id,
      v_row->>'teamId',
      coalesce((v_row->>'rank')::int, 0),
      coalesce((v_row->>'played')::int, 0),
      coalesce((v_row->>'wins')::int, 0),
      coalesce((v_row->>'losses')::int, 0),
      coalesce((v_row->>'subMatchWins')::int, 0),
      coalesce((v_row->>'subMatchLosses')::int, 0),
      coalesce((v_row->>'subMatchDiff')::int, 0),
      coalesce((v_row->>'pointsScored')::int, 0),
      coalesce((v_row->>'pointsConceded')::int, 0),
      coalesce((v_row->>'rankingPoints')::int, 0)
    );
  end loop;

  return json_build_object('ok', true);
end;
$$;

-- ─── Grants ───────────────────────────────────────────────────────
grant execute on function public.team_tournament_get_setup(text, text) to authenticated;
grant execute on function public.team_tournament_save_team(text, jsonb) to authenticated;
grant execute on function public.team_tournament_assign_member(text, text, text) to authenticated;
grant execute on function public.team_tournament_remove_member(text, text, text) to authenticated;
grant execute on function public.team_tournament_set_captain(text, text, text, text[]) to authenticated;
grant execute on function public.team_tournament_save_lineup_draft(text, text, text, jsonb) to authenticated;
grant execute on function public.team_tournament_submit_lineup(text, text, text, jsonb) to authenticated;
grant execute on function public.team_tournament_lock_matchup(text, text) to authenticated;
grant execute on function public.team_tournament_publish_matchup(text, text) to authenticated;
grant execute on function public.team_tournament_save_sub_match_draft(text, text, text, jsonb) to authenticated;
grant execute on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text) to authenticated;
grant execute on function public.team_tournament_get_standings(text) to authenticated;
grant execute on function public.team_tournament_upsert_standings(text, jsonb) to authenticated;

comment on table public.team_tournament_team_members is
  'Phase 23C — Roster normalized; dùng cho RLS captain scope + cross-team validation.';
comment on table public.team_tournament_lineup_entries is
  'Phase 23C — Selections normalized per discipline/player.';
comment on table public.team_tournament_standings is
  'Phase 23C — BXH cache; app compute rồi upsert qua RPC.';
comment on table public.team_tournament_audit_logs is
  'Phase 23C — Audit chuyên giải đồng đội; song song audit_logs chung.';
