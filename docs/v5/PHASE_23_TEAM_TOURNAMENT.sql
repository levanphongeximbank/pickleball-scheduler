-- Phase 23 — Team Tournament schema (v5 SaaS)
-- Idempotent migration. Chạy SAU supabase-multi-tenant-sprint2.sql + identity packs.
-- App hiện lưu teamData trong club_data_v3 blob; bảng dưới chuẩn bị cloud persistence.

-- ─── Permissions (additive) ───────────────────────────────────────
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

-- ─── Team tournaments ─────────────────────────────────────────────
create table if not exists public.team_tournaments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  tournament_id text not null,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','registration','ready','active','completed','cancelled')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, tournament_id)
);

create index if not exists team_tournaments_tenant_id_idx
  on public.team_tournaments (tenant_id);

-- ─── Teams ────────────────────────────────────────────────────────
create table if not exists public.team_tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_team_id text not null,
  name text not null,
  color text,
  logo_url text,
  captain_player_id text,
  deputy_player_ids text[] not null default '{}',
  player_ids text[] not null default '{}',
  absent_player_ids text[] not null default '{}',
  locked_player_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_tournament_id, external_team_id)
);

-- ─── Disciplines (custom categories) ──────────────────────────────
create table if not exists public.team_tournament_disciplines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
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
  unique (team_tournament_id, external_discipline_id)
);

-- ─── Team matchups ────────────────────────────────────────────────
create table if not exists public.team_tournament_matchups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  team_tournament_id uuid not null references public.team_tournaments(id) on delete cascade,
  external_matchup_id text not null,
  team_a_id text not null,
  team_b_id text not null,
  scheduled_at timestamptz,
  lineup_lock_at timestamptz,
  status text not null default 'lineup_open'
    check (status in ('scheduled','lineup_open','locked','published','in_progress','completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_tournament_id, external_matchup_id)
);

-- ─── Lineups per team per matchup ─────────────────────────────────
create table if not exists public.team_tournament_lineups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
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
  unique (matchup_id, team_external_id)
);

-- ─── Sub-match results ────────────────────────────────────────────
create table if not exists public.team_tournament_sub_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  matchup_id uuid not null references public.team_tournament_matchups(id) on delete cascade,
  external_sub_match_id text not null,
  discipline_external_id text not null,
  sort_order int not null default 1,
  status text not null default 'waiting'
    check (status in ('waiting','playing','completed','forfeit')),
  score jsonb not null default '{"teamA":0,"teamB":0}'::jsonb,
  winner_team_id text,
  unique (matchup_id, external_sub_match_id)
);

-- ─── RLS helpers ──────────────────────────────────────────────────
alter table public.team_tournaments enable row level security;
alter table public.team_tournament_teams enable row level security;
alter table public.team_tournament_disciplines enable row level security;
alter table public.team_tournament_matchups enable row level security;
alter table public.team_tournament_lineups enable row level security;
alter table public.team_tournament_sub_matches enable row level security;

drop policy if exists team_tournaments_tenant_select on public.team_tournaments;
create policy team_tournaments_tenant_select on public.team_tournaments
  for select using (
    public.is_super_admin()
    or tenant_id = (select venue_id from public.profiles where id = auth.uid())
  );

drop policy if exists team_tournaments_tenant_write on public.team_tournaments;
create policy team_tournaments_tenant_write on public.team_tournaments
  for all using (
    public.is_super_admin()
    or tenant_id = (select venue_id from public.profiles where id = auth.uid())
  )
  with check (
    public.is_super_admin()
    or tenant_id = (select venue_id from public.profiles where id = auth.uid())
  );

-- Mirror tenant policy for child tables
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'team_tournament_teams',
    'team_tournament_disciplines',
    'team_tournament_matchups',
    'team_tournament_lineups',
    'team_tournament_sub_matches'
  ]
  loop
    execute format('drop policy if exists %I_tenant_all on public.%I', tbl, tbl);
    execute format(
      'create policy %I_tenant_all on public.%I for all using (
         public.is_super_admin()
         or tenant_id = (select venue_id from public.profiles where id = auth.uid())
       ) with check (
         public.is_super_admin()
         or tenant_id = (select venue_id from public.profiles where id = auth.uid())
       )',
      tbl, tbl
    );
  end loop;
end $$;

comment on table public.team_tournaments is
  'Phase 23 — Giải đồng đội pickleball. App blob-first; bảng này cho cloud sync.';
