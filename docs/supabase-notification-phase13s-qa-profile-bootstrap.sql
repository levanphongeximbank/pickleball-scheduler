-- PICK_VN Notification Phase 1.3S
-- Staging-only QA profile tenant assignment bootstrap
-- Target project ref: qyewbxjsiiyufanzcjcq
-- DO NOT run on Production (expuvcohlcjzvrrauvud).
--
-- Apply via (reads STAGING_OWNER_A_EMAIL / STAGING_OWNER_B_EMAIL):
--   node scripts/apply-notification-phase13s-qa-profile-bootstrap.mjs
--
-- Do NOT paste this file with hard-coded emails into SQL Editor unless you
-- manually substitute the same emails from .env.staging-qa.local.
--
-- Membership model:
--   - Tenant = public.venues.id
--   - Primary access = public.profiles.venue_id (FK → venues.id)
--   - public.user_roles mirrors profiles via trigger (rbac-v4)
--
-- Placeholders replaced by the apply script:
--   {{OWNER_A_EMAIL}}  ← STAGING_OWNER_A_EMAIL
--   {{OWNER_B_EMAIL}}  ← STAGING_OWNER_B_EMAIL

insert into public.venues (id, name, slug, status)
values
  ('venue-staging-a', 'Venue Staging A', 'venue-staging-a', 'active'),
  ('venue-staging-b', 'Venue Staging B', 'venue-staging-b', 'active')
on conflict (id) do update
set
  name = excluded.name,
  status = case
    when public.venues.status in ('suspended') then public.venues.status
    else excluded.status
  end,
  updated_at = now();

update public.profiles
set
  role = 'VENUE_OWNER',
  venue_id = 'venue-staging-a',
  club_id = null,
  status = 'active',
  updated_at = now()
where lower(email) = lower('{{OWNER_A_EMAIL}}');

update public.profiles
set
  role = 'VENUE_OWNER',
  venue_id = 'venue-staging-b',
  club_id = null,
  status = 'active',
  updated_at = now()
where lower(email) = lower('{{OWNER_B_EMAIL}}');

update public.venues v
set owner_id = p.id, updated_at = now()
from public.profiles p
where v.id = 'venue-staging-a'
  and lower(p.email) = lower('{{OWNER_A_EMAIL}}')
  and v.owner_id is null;

update public.venues v
set owner_id = p.id, updated_at = now()
from public.profiles p
where v.id = 'venue-staging-b'
  and lower(p.email) = lower('{{OWNER_B_EMAIL}}')
  and v.owner_id is null;
