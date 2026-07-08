-- Phase 29 — Pick_VN VPR Ranking Engine + Certified Tournament Workflow
-- Idempotent migration. Chạy SAU:
--   supabase-identity-v40-phaseC.sql (user_has_permission, is_super_admin)
--
-- Staging: qyewbxjsiiyufanzcjcq | Production: expuvcohlcjzvrrauvud

-- ─── Permissions ─────────────────────────────────────────────────
insert into public.permissions (id, module, action, description)
values
  ('ranking.view', 'ranking', 'view', 'Xem bảng xếp hạng VPR'),
  ('ranking.manage', 'ranking', 'manage', 'Quản lý điểm VPR'),
  ('tournament.certify', 'tournament', 'certify', 'Duyệt giải Pick_VN Certified')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.role_id, p.id
from (values ('SUPER_ADMIN'), ('SYSTEM_TECHNICIAN')) as r(role_id)
cross join public.permissions p
where p.id in ('ranking.view', 'ranking.manage', 'tournament.certify')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.role_id, p.id
from (values ('VENUE_OWNER'), ('CLUB_OWNER')) as r(role_id)
cross join public.permissions p
where p.id = 'ranking.view'
on conflict do nothing;

-- ─── Point config ─────────────────────────────────────────────────
create table if not exists public.vpr_point_config (
  id uuid primary key default gen_random_uuid(),
  placement_key text not null,
  tournament_level text not null,
  base_points integer not null check (base_points >= 0),
  effective_from timestamptz not null default now(),
  is_active boolean not null default true,
  unique (placement_key, tournament_level, effective_from)
);

-- ─── Tournament certifications (cross-tenant queue) ─────────────
create table if not exists public.tournament_certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  club_id text not null,
  tournament_id text not null,
  name text not null,
  tournament_level text not null,
  mode text not null default 'official_tournament',
  certification_status text not null default 'pending'
    check (certification_status in ('not_required','pending','approved','rejected')),
  ranking_enabled boolean not null default false,
  rejection_reason text default '',
  host_club_name text default '',
  region text default '',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, tournament_id)
);

-- ─── VPR athletes (national registry) ───────────────────────────
create table if not exists public.vpr_athletes (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  gender text default 'unknown',
  region text default '',
  club_name text default '',
  auth_user_id uuid references auth.users (id) on delete set null,
  phone text default '',
  merge_status text not null default 'pending'
    check (merge_status in ('pending','linked','merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vpr_athlete_links (
  id uuid primary key default gen_random_uuid(),
  vpr_athlete_id uuid not null references public.vpr_athletes (id) on delete cascade,
  tenant_id text,
  club_id text not null,
  player_id text not null,
  created_at timestamptz not null default now(),
  unique (club_id, player_id)
);

-- ─── Ledger + leaderboard aggregate ───────────────────────────────
create table if not exists public.vpr_point_ledger (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null,
  tenant_id text,
  club_id text not null,
  tournament_id text not null,
  tournament_name text not null,
  tournament_level text not null,
  category text not null,
  placement_key text not null,
  points integer not null,
  vpr_athlete_id uuid not null references public.vpr_athletes (id) on delete cascade,
  display_name text default '',
  club_name text default '',
  region text default '',
  gender text default 'unknown',
  manual boolean not null default false,
  awarded_at timestamptz not null default now()
);

create table if not exists public.vpr_leaderboard (
  category text not null,
  vpr_athlete_id uuid not null references public.vpr_athletes (id) on delete cascade,
  display_name text default '',
  club_name text default '',
  region text default '',
  gender text default 'unknown',
  total_points integer not null default 0,
  rank integer not null default 0,
  tournaments_count integer not null default 0,
  best_placement text,
  updated_at timestamptz not null default now(),
  primary key (category, vpr_athlete_id)
);

create table if not exists public.vpr_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  tournament_id text,
  club_id text,
  vpr_athlete_id uuid references public.vpr_athletes (id) on delete set null,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── Seed default point table ─────────────────────────────────────
insert into public.vpr_point_config (placement_key, tournament_level, base_points)
values
  ('champion', 'certified', 150),
  ('champion', 'vpt_250', 250),
  ('champion', 'vpt_500', 500),
  ('champion', 'vpt_1000', 1000),
  ('champion', 'vpt_masters', 1500),
  ('champion', 'vpt_finals', 2000),
  ('runner_up', 'certified', 90),
  ('runner_up', 'vpt_250', 150),
  ('runner_up', 'vpt_500', 300),
  ('runner_up', 'vpt_1000', 600),
  ('runner_up', 'vpt_masters', 900),
  ('runner_up', 'vpt_finals', 1200),
  ('semifinal', 'certified', 55),
  ('semifinal', 'vpt_250', 90),
  ('semifinal', 'vpt_500', 180),
  ('semifinal', 'vpt_1000', 360),
  ('semifinal', 'vpt_masters', 540),
  ('semifinal', 'vpt_finals', 720),
  ('quarterfinal', 'certified', 30),
  ('quarterfinal', 'vpt_250', 45),
  ('quarterfinal', 'vpt_500', 90),
  ('quarterfinal', 'vpt_1000', 180),
  ('quarterfinal', 'vpt_masters', 270),
  ('quarterfinal', 'vpt_finals', 360),
  ('round_16', 'certified', 15),
  ('round_16', 'vpt_250', 25),
  ('round_16', 'vpt_500', 50),
  ('round_16', 'vpt_1000', 90),
  ('round_16', 'vpt_masters', 135),
  ('round_16', 'vpt_finals', 180),
  ('participation', 'certified', 5),
  ('participation', 'vpt_250', 10),
  ('participation', 'vpt_500', 20),
  ('participation', 'vpt_1000', 30),
  ('participation', 'vpt_masters', 45),
  ('participation', 'vpt_finals', 60)
on conflict do nothing;

-- ─── RLS ──────────────────────────────────────────────────────────
alter table public.vpr_point_config enable row level security;
alter table public.tournament_certifications enable row level security;
alter table public.vpr_athletes enable row level security;
alter table public.vpr_athlete_links enable row level security;
alter table public.vpr_point_ledger enable row level security;
alter table public.vpr_leaderboard enable row level security;
alter table public.vpr_audit_logs enable row level security;

drop policy if exists vpr_point_config_public_read on public.vpr_point_config;
create policy vpr_point_config_public_read on public.vpr_point_config
  for select to anon, authenticated using (is_active = true);

drop policy if exists vpr_leaderboard_public_read on public.vpr_leaderboard;
create policy vpr_leaderboard_public_read on public.vpr_leaderboard
  for select to anon, authenticated using (true);

drop policy if exists vpr_cert_admin_all on public.tournament_certifications;
create policy vpr_cert_admin_all on public.tournament_certifications
  for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('tournament.certify'))
  with check (public.is_super_admin() or public.user_has_permission('tournament.certify'));

drop policy if exists vpr_ledger_admin_read on public.vpr_point_ledger;
create policy vpr_ledger_admin_read on public.vpr_point_ledger
  for select to authenticated
  using (public.is_super_admin() or public.user_has_permission('ranking.manage'));

drop policy if exists vpr_audit_admin_read on public.vpr_audit_logs;
create policy vpr_audit_admin_read on public.vpr_audit_logs
  for select to authenticated
  using (public.is_super_admin() or public.user_has_permission('ranking.manage'));

-- ─── RPC: list pending certifications ───────────────────────────
create or replace function public.vpr_list_pending_certifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  if not (public.is_super_admin() or public.user_has_permission('tournament.certify')) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(to_jsonb(tc) order by tc.requested_at desc), '[]'::jsonb)
  into v_items
  from public.tournament_certifications tc
  where tc.certification_status = 'pending';

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$$;

-- ─── RPC: public leaderboard (read-only) ──────────────────────────
create or replace function public.vpr_list_public_leaderboard(
  p_category text default null,
  p_region text default null,
  p_gender text default null,
  p_year integer default null,
  p_search text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(lb)), '[]'::jsonb)
  into v_items
  from (
    select *
    from public.vpr_leaderboard lb
    where (p_category is null or lb.category = p_category)
      and (p_region is null or p_region = 'Tất cả' or lb.region = p_region)
      and (p_gender is null or lb.gender = p_gender)
      and (p_search = '' or lb.display_name ilike '%' || p_search || '%')
    order by lb.rank asc
    limit 200
  ) lb;

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$$;

grant execute on function public.vpr_list_public_leaderboard(text, text, text, integer, text) to anon, authenticated;
grant execute on function public.vpr_list_pending_certifications() to authenticated;
