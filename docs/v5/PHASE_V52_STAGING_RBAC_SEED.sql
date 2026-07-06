-- =============================================================================
-- V5.2 — Staging RBAC seed: SYSTEM_TECHNICIAN + TEAM_CAPTAIN
-- Project: qyewbxjsiiyufanzcjcq (pickleball-scheduler **staging**)
--
-- Tiên quyết:
--   1. Gate 2 / identity SQL đã apply trên staging
--   2. docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql đã chạy (cùng nội dung, idempotent)
--   3. Auth users đã đăng ký qua app /login:
--        • tech@staging.local      — Kỹ thuật viên hệ thống
--        • player@staging.local    — Đội trưởng probe (đã có từ Phase 10D)
--   4. (Tuỳ chọn captain portal) Giải probe đã seed:
--        npm run seed:team-tournament-cloud -- --blob-path=tests/fixtures/team-tournament-blob-probe.json
--
-- Idempotent · additive only · KHÔNG chạy trên Production expuvcohlcjzvrrauvud
-- Chạy: Supabase Dashboard → SQL Editor (staging ref qyewbxjsiiyufanzcjcq)
-- =============================================================================

begin;

-- ─── Mapping staging V5.2 accounts ───────────────────────────────────────────
create temp table _v52_staging_accounts (
  email text primary key,
  role text not null,
  venue_id text,
  player_id text,
  tournament_id text,
  team_id text,
  display_name_default text not null
) on commit drop;

insert into _v52_staging_accounts (
  email, role, venue_id, player_id, tournament_id, team_id, display_name_default
) values
  (
    'tech@staging.local',
    'SYSTEM_TECHNICIAN',
    null,
    null,
    null,
    null,
    'Kỹ thuật Staging'
  ),
  (
    'player@staging.local',
    'TEAM_CAPTAIN',
    'venue-staging-a',
    'player-staging-a-1',
    'phase23d-probe-tournament',
    'phase23d-team-a',
    'Đội trưởng Staging A'
  );

-- Fail-fast: role phải hợp lệ theo profiles_role_check V5.2
do $$
declare
  v_invalid text;
begin
  select string_agg(distinct t.role, ', ')
  into v_invalid
  from _v52_staging_accounts t
  where t.role not in (
    'SUPER_ADMIN', 'PLATFORM_ADMIN', 'SYSTEM_TECHNICIAN',
    'VENUE_OWNER', 'VENUE_MANAGER', 'COURT_OWNER', 'COURT_MANAGER',
    'TENANT_OWNER', 'TOURNAMENT_MANAGER', 'TEAM_CAPTAIN',
    'CASHIER', 'ACCOUNTANT', 'REFEREE',
    'CLUB_OWNER', 'CLUB_MANAGER', 'COACH', 'STAFF',
    'PLAYER', 'CUSTOMER', 'SUPPORT'
  );

  if v_invalid is not null then
    raise exception 'INVALID_ROLE: % — chạy PHASE_V52_PRODUCTION_RBAC_ROLES.sql trước', v_invalid;
  end if;
end $$;

-- Fail-fast: venue probe phải tồn tại (không tạo venue mới ở đây)
do $$
begin
  if not exists (select 1 from public.venues where id = 'venue-staging-a') then
    raise exception 'VENUE_MISSING: venue-staging-a — chạy docs/supabase-billing-phase10e-staging-tenant-align.sql trước';
  end if;
end $$;

-- ─── 1) Insert profile từ auth.users nếu chưa có ─────────────────────────────
insert into public.profiles (
  id, email, display_name, role, venue_id, club_id, player_id, tournament_id, team_id, status
)
select
  u.id,
  u.email,
  coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), t.display_name_default),
  t.role,
  t.venue_id,
  case when t.role = 'TEAM_CAPTAIN' then coalesce(p.club_id, 'club-staging-demo') else null end,
  t.player_id,
  t.tournament_id,
  t.team_id,
  'active'
from auth.users u
join _v52_staging_accounts t on t.email = u.email
left join public.profiles p on p.id = u.id
on conflict (id) do nothing;

-- ─── 2) Reconcile role + scope (idempotent) ──────────────────────────────────
update public.profiles p
set
  role = t.role,
  venue_id = t.venue_id,
  player_id = coalesce(t.player_id, p.player_id),
  tournament_id = coalesce(t.tournament_id, p.tournament_id),
  team_id = coalesce(t.team_id, p.team_id),
  club_id = case
    when t.role = 'SYSTEM_TECHNICIAN' then null
    when t.role = 'TEAM_CAPTAIN' then coalesce(p.club_id, 'club-staging-demo')
    else p.club_id
  end,
  status = 'active',
  display_name = coalesce(nullif(trim(p.display_name), ''), t.display_name_default),
  updated_at = now()
from _v52_staging_accounts t
where p.email = t.email;

-- SYSTEM_TECHNICIAN: platform scope — không gắn venue/club
update public.profiles
set
  venue_id = null,
  club_id = null,
  tournament_id = null,
  team_id = null,
  updated_at = now()
where email = 'tech@staging.local'
  and role = 'SYSTEM_TECHNICIAN';

commit;

-- ─── Verification V52-S1 → V52-S6 (chạy sau commit) ───────────────────────────
-- V52-S1: constraint cho phép V5.2 roles
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_role_check';

-- V52-S2: roles catalog
select id, label
from public.roles
where id in ('SYSTEM_TECHNICIAN', 'TEAM_CAPTAIN')
order by id;

-- V52-S3: permission counts
select
  (select count(*) from public.role_permissions where role_id = 'SYSTEM_TECHNICIAN') as tech_perm_count,
  (select count(*) from public.role_permissions where role_id = 'TEAM_CAPTAIN') as captain_perm_count;

-- V52-S4: staging accounts
select email, role, venue_id, player_id, tournament_id, team_id, status
from public.profiles
where email in ('tech@staging.local', 'player@staging.local')
order by email;

-- V52-S5: auth user thiếu (0 rows = PASS)
select t.email as missing_auth_user
from (values ('tech@staging.local'), ('player@staging.local')) as t(email)
where not exists (select 1 from auth.users u where u.email = t.email);

-- V52-S6: không có role lạ trên staging
select distinct role
from public.profiles
where email like '%@staging.local'
  and role is not null
  and role not in (
    'SUPER_ADMIN', 'PLATFORM_ADMIN', 'SYSTEM_TECHNICIAN',
    'VENUE_OWNER', 'VENUE_MANAGER', 'COURT_OWNER', 'COURT_MANAGER',
    'TENANT_OWNER', 'TOURNAMENT_MANAGER', 'TEAM_CAPTAIN',
    'CASHIER', 'ACCOUNTANT', 'REFEREE',
    'CLUB_OWNER', 'CLUB_MANAGER', 'COACH', 'STAFF',
    'PLAYER', 'CUSTOMER', 'SUPPORT'
  );
