-- Rollback for docs/supabase-notification-phase13s-qa-profile-bootstrap.sql
-- Staging only (qyewbxjsiiyufanzcjcq). Do NOT run on Production.
--
-- Apply via:
--   node scripts/apply-notification-phase13s-qa-profile-bootstrap.mjs --rollback
--
-- Placeholders:
--   {{OWNER_A_EMAIL}}  ← STAGING_OWNER_A_EMAIL
--   {{OWNER_B_EMAIL}}  ← STAGING_OWNER_B_EMAIL

update public.profiles
set
  role = 'PLAYER',
  venue_id = null,
  updated_at = now()
where lower(email) in (
  lower('{{OWNER_A_EMAIL}}'),
  lower('{{OWNER_B_EMAIL}}')
);

update public.venues v
set owner_id = null, updated_at = now()
from public.profiles p
where v.owner_id = p.id
  and v.id in ('venue-staging-a', 'venue-staging-b')
  and lower(p.email) in (
    lower('{{OWNER_A_EMAIL}}'),
    lower('{{OWNER_B_EMAIL}}')
  );
