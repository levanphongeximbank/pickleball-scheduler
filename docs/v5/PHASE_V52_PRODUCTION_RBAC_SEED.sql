-- =============================================================================
-- V5.2 — Production RBAC seed: SYSTEM_TECHNICIAN (+ xác nhận TEAM_CAPTAIN)
-- Project: expuvcohlcjzvrrauvud (pickleball-scheduler-production)
--
-- Tiên quyết:
--   1. docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql đã chạy (V52-1 → V52-8 PASS)
--   2. Auth user đã đăng ký qua app Production /login:
--        • kythuat@gmail.com — Kỹ thuật viên hệ thống (đổi email dưới nếu cần)
--   3. doitruong@gmail.com đã có auth (Phase 19B) — role TEAM_CAPTAIN từ file V5.2
--
-- Idempotent · additive only · KHÔNG chạy trên staging qyewbxjsiiyufanzcjcq
-- Chạy: Supabase Dashboard → SQL Editor (ref expuvcohlcjzvrrauvud)
-- =============================================================================

begin;

create temp table _v52_prod_accounts (
  email text primary key,
  role text not null,
  venue_id text,
  player_id text,
  tournament_id text,
  team_id text,
  display_name_default text not null
) on commit drop;

insert into _v52_prod_accounts (
  email, role, venue_id, player_id, tournament_id, team_id, display_name_default
) values
  (
    'kythuat@gmail.com',
    'SYSTEM_TECHNICIAN',
    null,
    null,
    null,
    null,
    'Kỹ thuật Production'
  ),
  (
    'doitruong@gmail.com',
    'TEAM_CAPTAIN',
    'venue-prod-main',
    null,
    coalesce(nullif('REPLACE_ME_TOURNAMENT_ID', 'REPLACE_ME_TOURNAMENT_ID'), null),
    coalesce(nullif('REPLACE_ME_TEAM_EXTERNAL_ID', 'REPLACE_ME_TEAM_EXTERNAL_ID'), null),
    'Đội trưởng Test'
  );

-- Fail-fast: role hợp lệ V5.2
do $$
declare
  v_invalid text;
begin
  select string_agg(distinct t.role, ', ')
  into v_invalid
  from _v52_prod_accounts t
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

-- Insert profile từ auth.users nếu chưa có
insert into public.profiles (
  id, email, display_name, role, venue_id, club_id, player_id, tournament_id, team_id, status
)
select
  u.id,
  u.email,
  coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), t.display_name_default),
  t.role,
  t.venue_id,
  null,
  t.player_id,
  t.tournament_id,
  t.team_id,
  'active'
from auth.users u
join _v52_prod_accounts t on t.email = u.email
on conflict (id) do nothing;

-- Reconcile
update public.profiles p
set
  role = t.role,
  venue_id = case when t.role = 'SYSTEM_TECHNICIAN' then null else coalesce(t.venue_id, p.venue_id) end,
  player_id = coalesce(t.player_id, p.player_id),
  tournament_id = case
    when t.role = 'TEAM_CAPTAIN' and t.tournament_id is not null then t.tournament_id
    else p.tournament_id
  end,
  team_id = case
    when t.role = 'TEAM_CAPTAIN' and t.team_id is not null then t.team_id
    else p.team_id
  end,
  club_id = case when t.role = 'SYSTEM_TECHNICIAN' then null else p.club_id end,
  status = 'active',
  display_name = coalesce(nullif(trim(p.display_name), ''), t.display_name_default),
  updated_at = now()
from _v52_prod_accounts t
where p.email = t.email;

-- SYSTEM_TECHNICIAN: platform scope
update public.profiles
set venue_id = null, club_id = null, tournament_id = null, team_id = null, updated_at = now()
where email = 'kythuat@gmail.com' and role = 'SYSTEM_TECHNICIAN';

commit;

-- ─── Verification V52-P1 → V52-P5 ───────────────────────────────────────────
select id, label from public.roles
where id in ('SYSTEM_TECHNICIAN', 'TEAM_CAPTAIN') order by id;

select
  (select count(*)::int from public.role_permissions where role_id = 'SYSTEM_TECHNICIAN') as tech_perm_count,
  (select count(*)::int from public.role_permissions where role_id = 'TEAM_CAPTAIN') as captain_perm_count;

select email, role, venue_id, tournament_id, team_id, status
from public.profiles
where email in ('kythuat@gmail.com', 'doitruong@gmail.com', 'lephong.eximbank@gmail.com')
order by email;

select t.email as missing_auth_user
from (values ('kythuat@gmail.com')) as t(email)
where not exists (select 1 from auth.users u where u.email = t.email);
