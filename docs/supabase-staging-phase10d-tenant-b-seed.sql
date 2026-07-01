-- Phase 10D — Staging Tenant B seed (cross-tenant RLS QA)
-- Project: qyewbxjsiiyufanzcjcq ONLY — không chạy production.
--
-- Prerequisites:
--   1. venues venue-staging-a / venue-staging-b đã có (Phase 10E SQL)
--   2. Đăng ký qua app /login: owner-b@staging.local (password tạm — không commit)
--
-- Sau khi user tồn tại trong auth.users:

update public.profiles
set
  role = 'VENUE_OWNER',
  venue_id = 'venue-staging-b',
  club_id = null,
  status = 'active',
  display_name = 'Owner Staging B'
where email = 'owner-b@staging.local';

-- Optional: manager Tenant B
-- Đăng ký manager-b@staging.local rồi:
-- update public.profiles
-- set role = 'VENUE_MANAGER', venue_id = 'venue-staging-b', club_id = null, status = 'active'
-- where email = 'manager-b@staging.local';

-- Billing isolation probe (optional — admin tạo trial cho B):
-- select * from public.tenant_subscriptions where tenant_id = 'venue-staging-b';

-- Verify alignment:
select email, role, venue_id, status
from public.profiles
where email in ('owner@staging.local', 'owner-b@staging.local')
order by email;
