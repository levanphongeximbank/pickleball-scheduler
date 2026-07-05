-- =============================================================================
-- Phase 19B — Production test accounts RBAC (public.profiles)
-- Project: expuvcohlcjzvrrauvud (pickleball-scheduler-production)
--
-- Tiên quyết (owner đã làm):
--   • 6 auth.users đã tạo trên Supabase Auth (Production)
--   • venue-prod-main đã tồn tại (bootstrap tenant — không tạo/xóa ở đây)
--
-- Idempotent, additive only:
--   • Insert profile từ auth.users nếu chưa có
--   • Update role / venue_id / status nếu đã có
--   • Không xóa auth.users
--   • Không xóa venue-prod-main
--   • Không bật payment live / không insert tenant_subscriptions paid
--   • Chỉ dùng role có trong profiles_role_check (v4)
--
-- Chạy: Supabase Dashboard → SQL Editor (postgres / service_role bypass guard)
-- =============================================================================

-- Discovery — chạy trước khi apply (owner lưu kết quả)
select id, email, email_confirmed_at, created_at
from auth.users
where email in (
  'lephong.eximbank@gmail.com',
  'chusantest@gmail.com',
  'ketoan@gmail.com',
  'chutichclb@gmail.com',
  'trongtai@gmail.com',
  'doitruong@gmail.com'
)
order by email;

select p.id, p.email, p.role, p.venue_id, p.club_id, p.status
from public.profiles p
where p.email in (
  'lephong.eximbank@gmail.com',
  'chusantest@gmail.com',
  'ketoan@gmail.com',
  'chutichclb@gmail.com',
  'trongtai@gmail.com',
  'doitruong@gmail.com'
)
order by p.email;

begin;

-- Snapshot trước khi sửa
select 'pre_profiles' as snap, p.*
from public.profiles p
where p.email in (
  'lephong.eximbank@gmail.com',
  'chusantest@gmail.com',
  'ketoan@gmail.com',
  'chutichclb@gmail.com',
  'trongtai@gmail.com',
  'doitruong@gmail.com'
)
order by p.email;

-- ─── Mapping test accounts ───────────────────────────────────────────────────
create temp table _phase19b_test_accounts (
  email text primary key,
  role text not null,
  venue_id text,
  display_name_default text not null
) on commit drop;

insert into _phase19b_test_accounts (email, role, venue_id, display_name_default)
values
  ('lephong.eximbank@gmail.com', 'SUPER_ADMIN', null, 'Platform Founder'),
  ('chusantest@gmail.com',       'COURT_OWNER', 'venue-prod-main', 'Production Test Owner'),
  ('ketoan@gmail.com',           'CASHIER',     'venue-prod-main', 'Thu ngân Test'),
  ('chutichclb@gmail.com',       'CLUB_OWNER',  'venue-prod-main', 'Chủ tịch CLB Test'),
  ('trongtai@gmail.com',         'REFEREE',     'venue-prod-main', 'Trọng tài Test'),
  ('doitruong@gmail.com',        'PLAYER',      'venue-prod-main', 'Đội trưởng Test');

-- Fail-fast: venue tenant phải tồn tại (không tạo mới ở script này)
do $$
begin
  if not exists (
    select 1 from public.venues where id = 'venue-prod-main'
  ) then
    raise exception 'VENUE_MISSING: venue-prod-main chưa tồn tại — bootstrap venue trước (PHASE_19B_PRODUCTION_COURT_OWNER_TEST_ACCOUNT.sql)';
  end if;
end $$;

-- Fail-fast: role phải hợp lệ theo constraint v4
do $$
declare
  v_invalid text;
begin
  select string_agg(distinct t.role, ', ')
  into v_invalid
  from _phase19b_test_accounts t
  where t.role not in (
    'SUPER_ADMIN',
    'VENUE_OWNER', 'VENUE_MANAGER',
    'COURT_OWNER', 'COURT_MANAGER',
    'CASHIER', 'ACCOUNTANT', 'REFEREE',
    'CLUB_OWNER', 'PLAYER'
  );

  if v_invalid is not null then
    raise exception 'INVALID_ROLE: %', v_invalid;
  end if;
end $$;

-- ─── 1) Insert profile nếu chưa có (từ auth.users) ───────────────────────────
insert into public.profiles (id, email, display_name, role, venue_id, club_id, status)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
    t.display_name_default
  ),
  t.role,
  t.venue_id,
  null,
  'active'
from auth.users u
join _phase19b_test_accounts t on t.email = u.email
on conflict (id) do nothing;

-- ─── 2) Update role / venue_id / status (idempotent reconcile) ───────────────
update public.profiles p
set
  role = t.role,
  venue_id = t.venue_id,
  club_id = case when t.role = 'SUPER_ADMIN' then null else p.club_id end,
  status = 'active',
  display_name = coalesce(
    nullif(trim(p.display_name), ''),
    t.display_name_default
  ),
  updated_at = now()
from _phase19b_test_accounts t
where p.email = t.email;

-- Founder: đảm bảo không gắn tenant
update public.profiles
set
  venue_id = null,
  club_id = null,
  updated_at = now()
where email = 'lephong.eximbank@gmail.com'
  and role = 'SUPER_ADMIN';

-- ─── 3) Align venues.owner_id → COURT_OWNER test (không đổi venue row khác) ─
update public.venues v
set
  owner_id = p.id,
  updated_at = now()
from public.profiles p
where v.id = 'venue-prod-main'
  and p.email = 'chusantest@gmail.com'
  and p.role = 'COURT_OWNER';

-- Fail-safe: báo auth user / profile thiếu
do $$
declare
  v_missing_auth text;
  v_missing_profile text;
begin
  select string_agg(t.email, ', ' order by t.email)
  into v_missing_auth
  from _phase19b_test_accounts t
  where not exists (
    select 1 from auth.users u where u.email = t.email
  );

  if v_missing_auth is not null then
    raise exception 'AUTH_USER_MISSING: %', v_missing_auth;
  end if;

  select string_agg(t.email, ', ' order by t.email)
  into v_missing_profile
  from _phase19b_test_accounts t
  where not exists (
    select 1 from public.profiles p where p.email = t.email
  );

  if v_missing_profile is not null then
    raise exception 'PROFILE_MISSING: %', v_missing_profile;
  end if;
end $$;

commit;

-- =============================================================================
-- Verification (chạy sau commit — không phụ thuộc temp table)
-- =============================================================================

-- V1 — Ma trận RBAC kỳ vọng (6 tài khoản)
with expected as (
  select * from (values
    ('lephong.eximbank@gmail.com', 'SUPER_ADMIN', null::text),
    ('chusantest@gmail.com',       'COURT_OWNER', 'venue-prod-main'),
    ('ketoan@gmail.com',           'CASHIER',     'venue-prod-main'),
    ('chutichclb@gmail.com',       'CLUB_OWNER',  'venue-prod-main'),
    ('trongtai@gmail.com',         'REFEREE',     'venue-prod-main'),
    ('doitruong@gmail.com',        'PLAYER',      'venue-prod-main')
  ) as v(email, role, venue_id)
)
select
  e.email,
  e.role as expected_role,
  p.role as actual_role,
  p.venue_id,
  p.status,
  case
    when p.role = e.role
      and p.status = 'active'
      and (
        (e.venue_id is null and p.venue_id is null)
        or p.venue_id = e.venue_id
      ) then 'ok'
    else 'CHECK'
  end as rbac_check
from expected e
left join public.profiles p on p.email = e.email
order by e.email;

-- V2 — Founder không gắn venue / club
select
  p.email,
  p.role,
  p.venue_id,
  p.club_id,
  case
    when p.role = 'SUPER_ADMIN' and p.venue_id is null and p.club_id is null then 'ok_founder'
    else 'CHECK'
  end as founder_check
from public.profiles p
where p.email = 'lephong.eximbank@gmail.com';

-- V3 — COURT_OWNER aligned với venue-prod-main
select
  p.email,
  p.role,
  p.venue_id as profile_venue_id,
  v.id as matched_venue_id,
  v.owner_id,
  p.id as profile_id,
  case
    when p.role = 'COURT_OWNER'
      and p.venue_id = v.id
      and v.owner_id = p.id then 'ok_aligned'
    else 'MISALIGNED'
  end as owner_alignment
from public.profiles p
cross join public.venues v
where p.email = 'chusantest@gmail.com'
  and v.id = 'venue-prod-main';

-- V4 — venue-prod-main vẫn tồn tại (không bị xóa)
select id, name, slug, owner_id, status, updated_at
from public.venues
where id = 'venue-prod-main';

-- V5 — Auth users đủ 6 email
select
  count(*) as auth_user_count,
  case when count(*) = 6 then 'ok' else 'CHECK' end as auth_check
from auth.users
where email in (
  'lephong.eximbank@gmail.com',
  'chusantest@gmail.com',
  'ketoan@gmail.com',
  'chutichclb@gmail.com',
  'trongtai@gmail.com',
  'doitruong@gmail.com'
);

-- V6 — Email thiếu auth user (expect 0 rows)
with expected_emails as (
  select unnest(array[
    'lephong.eximbank@gmail.com',
    'chusantest@gmail.com',
    'ketoan@gmail.com',
    'chutichclb@gmail.com',
    'trongtai@gmail.com',
    'doitruong@gmail.com'
  ]) as email
)
select e.email as missing_auth_user
from expected_emails e
where not exists (
  select 1 from auth.users u where u.email = e.email
);

-- V7 — Không có role lạ trong batch test
select p.email, p.role
from public.profiles p
where p.email in (
  'lephong.eximbank@gmail.com',
  'chusantest@gmail.com',
  'ketoan@gmail.com',
  'chutichclb@gmail.com',
  'trongtai@gmail.com',
  'doitruong@gmail.com'
)
and p.role not in (
  'SUPER_ADMIN',
  'VENUE_OWNER', 'VENUE_MANAGER',
  'COURT_OWNER', 'COURT_MANAGER',
  'CASHIER', 'ACCOUNTANT', 'REFEREE',
  'CLUB_OWNER', 'PLAYER'
);
-- expect: 0 rows

-- V8 — Founder không có subscription tenant riêng (cross-tenant safety)
select ts.*
from public.tenant_subscriptions ts
join public.profiles p on p.venue_id = ts.tenant_id
where p.email = 'lephong.eximbank@gmail.com';
-- expect: 0 rows
