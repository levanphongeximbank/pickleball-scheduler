-- PLATFORM-HARD-CUTOVER-01 Phase 4 — Identity preservation pre-check (READ-ONLY)
-- Do NOT apply wipe until this script returns PASS rows for Owner.
-- Never prints secrets. Record Owner UUID offline (hash allowed).
-- NOT executed by this PR.

-- A) Auth user count (expect >= 1; Owner must exist)
SELECT count(*) AS auth_user_count FROM auth.users;

-- B) Profiles count (expect match auth-linked population)
SELECT count(*) AS profile_count FROM public.profiles;

-- C) Role distribution (no PII)
SELECT role::text AS role, count(*) AS n
FROM public.profiles
GROUP BY 1
ORDER BY 2 DESC;

-- D) Owner tenant
SELECT count(*) AS venue_count FROM public.venues;
SELECT count(*) AS tenant_member_count FROM public.tenant_members;

-- E) RBAC catalog
SELECT
  (SELECT count(*) FROM public.roles) AS roles_n,
  (SELECT count(*) FROM public.permissions) AS permissions_n,
  (SELECT count(*) FROM public.role_permissions) AS role_permissions_n;

-- F) club_data_v3 policies still present
SELECT pol.polname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'club_data_v3'
ORDER BY 1;

-- G) Public catalog RPCs
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'public_catalog_list_%'
ORDER BY 1;

-- H) G3-B12 posture (until DROP)
SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'club_ai_data';

SELECT pol.polname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'club_ai_data'
ORDER BY 1;
