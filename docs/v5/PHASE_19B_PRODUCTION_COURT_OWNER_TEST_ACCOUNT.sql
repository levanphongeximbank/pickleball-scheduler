-- =============================================================================
-- Phase 19B — COURT_OWNER test account (Production smoke A2/A4/A5)
-- Project: expuvcohlcjzvrrauvud
--
-- Mục đích: tài khoản tenant test RIÊNG — không dùng email founder.
-- Trước khi chạy:
--   1) Owner tạo auth user qua app (signup hoặc Supabase Auth invite)
--   2) Thay TEST_OWNER_EMAIL và TEST_OWNER_UUID từ discovery query bên dưới
--   3) Founder đã promote SUPER_ADMIN (PHASE_19B_PRODUCTION_FOUNDER_SUPER_ADMIN.sql)
--
-- Mapping: profiles.venue_id = venues.id = tenant_subscriptions.tenant_id
-- Trial: gọi billing_create_trial_subscription từ app sau khi login (không insert trực tiếp)
-- =============================================================================

-- Discovery — điền sau khi tạo user test
-- select id, email from auth.users where email = 'TEST_OWNER_EMAIL';
-- select * from public.profiles where email = 'TEST_OWNER_EMAIL';

begin;

-- ─── Placeholders (owner thay trước khi Run) ─────────────────────────────────
-- Email gợi ý: owner-test+<random>@your-domain.com (không dùng lephong.eximbank@gmail.com)
-- TEST_OWNER_EMAIL = '________________________'
-- TEST_OWNER_UUID  = '________________________'

insert into public.venues (
  id,
  name,
  slug,
  owner_id,
  timezone,
  status,
  note
)
values (
  'venue-prod-main',
  'Pickleball Scheduler Production Test',
  'pickleball-prod-main',
  'TEST_OWNER_UUID'::uuid,
  'Asia/Ho_Chi_Minh',
  'trial',
  'Phase 19B COURT_OWNER smoke test tenant'
)
on conflict (id) do update
set
  name = excluded.name,
  owner_id = coalesce(excluded.owner_id, public.venues.owner_id),
  status = excluded.status,
  updated_at = now();

insert into public.profiles (id, email, display_name, role, venue_id, club_id, status)
select
  u.id,
  u.email,
  coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), 'Production Test Owner'),
  'COURT_OWNER',
  'venue-prod-main',
  null,
  'active'
from auth.users u
where u.email = 'TEST_OWNER_EMAIL'
on conflict (id) do update
set
  role = 'COURT_OWNER',
  venue_id = 'venue-prod-main',
  club_id = null,
  status = 'active',
  updated_at = now();

update public.venues
set owner_id = 'TEST_OWNER_UUID'::uuid, updated_at = now()
where id = 'venue-prod-main';

do $$
begin
  if not exists (select 1 from auth.users where email = 'TEST_OWNER_EMAIL') then
    raise exception 'AUTH_USER_MISSING: tạo TEST_OWNER_EMAIL trước (signup / invite)';
  end if;
end $$;

commit;

-- Verification
select
  p.email,
  p.role,
  p.venue_id,
  v.id as matched_venue,
  v.owner_id,
  case
    when p.role = 'COURT_OWNER'
      and p.venue_id = v.id
      and v.owner_id = p.id then 'ok_aligned'
    else 'MISALIGNED'
  end as alignment
from public.profiles p
left join public.venues v on v.id = p.venue_id
where p.email = 'TEST_OWNER_EMAIL';

-- Trial subscription — login TEST_OWNER rồi mở /billing (RPC), hoặc SUPER_ADMIN gọi RPC:
-- select public.billing_create_trial_subscription('venue-prod-main');

select ts.tenant_id, ts.status, ts.plan_id
from public.tenant_subscriptions ts
where ts.tenant_id = 'venue-prod-main';
