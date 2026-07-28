-- PLATFORM-HARD-CUTOVER-01 reseed step 01 — Owner tenant VERIFY ONLY
-- NOT EXECUTED in pre-Staging remediation PR.
-- FORBIDDEN: Auth user create/update/delete; Owner UUID change; venue wipe.

-- Expect: Owner Auth user + venue + tenant_members unchanged from pre-wipe snapshot.
SELECT
  u.id AS owner_user_id,
  u.email AS owner_email_present,
  v.id AS venue_id,
  tm.user_id AS tenant_member_user_id,
  tm.role AS tenant_member_role
FROM auth.users u
LEFT JOIN public.tenant_members tm ON tm.user_id = u.id
LEFT JOIN public.venues v ON v.id::text = tm.venue_id::text OR v.id::text = public.user_venue_id()
WHERE u.id IS NOT NULL
LIMIT 20;

-- Guard: refuse if this script is mistakenly used as a mutator.
DO $$
BEGIN
  RAISE NOTICE '01_OWNER_TENANT_VERIFY_ONLY: read-only verify — no mutations performed';
END $$;
