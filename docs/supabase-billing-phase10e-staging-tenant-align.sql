-- Phase 10E — Staging tenant/venue alignment for Billing
-- Mục tiêu: profiles.venue_id = venues.id = tenant_subscriptions.tenant_id
-- KHÔNG apply production. Chỉ staging / manual QA.
-- Rollback: xem cuối file.

-- =============================================================================
-- 1) Diagnostic — chạy trước khi sửa
-- =============================================================================

-- Profiles thiếu venue hoặc venue không tồn tại
select
  p.id,
  p.email,
  p.role,
  p.venue_id,
  v.id as matched_venue_id,
  v.name as venue_name,
  case
    when p.venue_id is null then 'missing_venue_id'
    when v.id is null then 'orphan_venue_id'
    else 'ok'
  end as alignment_status
from public.profiles p
left join public.venues v on v.id = p.venue_id
where p.role in ('COURT_OWNER', 'VENUE_OWNER', 'CLUB_OWNER', 'VENUE_MANAGER', 'CASHIER', 'PLAYER')
order by p.email;

-- Subscriptions orphan (tenant_id không có trong venues)
select ts.id, ts.tenant_id, ts.status, ts.plan_id
from public.tenant_subscriptions ts
left join public.venues v on v.id = ts.tenant_id
where v.id is null;

-- =============================================================================
-- 2) Ensure staging venues (idempotent)
-- =============================================================================

insert into public.venues (id, name, slug, status)
values
  ('venue-staging-a', 'Venue Staging A', 'venue-staging-a', 'trial'),
  ('venue-staging-b', 'Venue Staging B', 'venue-staging-b', 'trial')
on conflict (id) do update
set
  name = excluded.name,
  status = excluded.status,
  updated_at = now();

-- =============================================================================
-- 3) Align owner/manager test accounts (adjust email if project khác)
-- =============================================================================

-- owner@staging.local → venue-staging-a
update public.profiles
set venue_id = 'venue-staging-a', updated_at = now()
where email = 'owner@staging.local'
  and role in ('COURT_OWNER', 'VENUE_OWNER');

-- manager@staging.local → venue-staging-a
update public.profiles
set venue_id = 'venue-staging-a', updated_at = now()
where email = 'manager@staging.local'
  and role in ('COURT_MANAGER', 'VENUE_MANAGER');

-- club@staging.local / player@staging.local → venue-staging-a
update public.profiles
set venue_id = 'venue-staging-a', updated_at = now()
where email in ('club@staging.local', 'player@staging.local')
  and venue_id is distinct from 'venue-staging-a';

-- Gỡ legacy placeholder nếu còn
update public.profiles
set venue_id = 'venue-staging-a', updated_at = now()
where venue_id in ('tenant-demo', 'tenant_demo', 'demo-tenant')
  and email like '%@staging.local';

-- =============================================================================
-- 4) Verify alignment sau update
-- =============================================================================

select p.email, p.role, p.venue_id, v.name
from public.profiles p
left join public.venues v on v.id = p.venue_id
where p.email like '%@staging.local'
order by p.email;

-- =============================================================================
-- 5) Trial subscription — dùng RPC (không insert trực tiếp)
-- =============================================================================
-- Đăng nhập owner@staging.local trên app → /billing hoặc Admin → Tạo trial
-- Hoặc SQL Editor với JWT owner (không dùng service role bypass RLS trừ SUPER_ADMIN test):
--   select public.billing_create_trial_subscription('venue-staging-a');

select ts.tenant_id, ts.status, ts.plan_id, ts.trial_start_date, ts.trial_end_date
from public.tenant_subscriptions ts
where ts.tenant_id = 'venue-staging-a';

-- =============================================================================
-- Rollback note (manual)
-- =============================================================================
-- Khôi phục venue_id cũ từ backup profiles nếu cần.
-- Xóa subscription trial test:
--   delete from public.tenant_subscriptions where tenant_id = 'venue-staging-a' and status = 'trialing';
-- Không drop bảng venues.
