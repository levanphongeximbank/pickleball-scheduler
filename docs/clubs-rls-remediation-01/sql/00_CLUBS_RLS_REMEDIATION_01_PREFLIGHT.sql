-- =============================================================================
-- CLUBS-RLS-REMEDIATION-01 — PREFLIGHT (read-only)
-- Run against Staging before forward apply. No DML / no policy mutation.
-- Do NOT print secrets / JWTs / service role keys.
-- =============================================================================

-- 1) Target identity (confirm Staging ref manually via dashboard / connection)
SELECT current_database() AS db, current_user AS db_user, now() AS checked_at;

-- 2) RLS enabled on public.clubs
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'clubs';

-- 3) Existing policies on public.clubs
SELECT pol.polname AS policy_name,
       CASE pol.polcmd
         WHEN 'r' THEN 'SELECT'
         WHEN 'a' THEN 'INSERT'
         WHEN 'w' THEN 'UPDATE'
         WHEN 'd' THEN 'DELETE'
         WHEN '*' THEN 'ALL'
       END AS command,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr,
       ARRAY(
         SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY (pol.polroles)
       ) AS roles
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'clubs'
ORDER BY pol.polname;

-- 4) Detect BROAD club-row status='active' branch in clubs_select
--    (excludes legitimate cm.status = 'active' in membership EXISTS).
--    Expected PRE-apply on Production/legacy Staging: true
SELECT
  EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'clubs'
      AND pol.polname = 'clubs_select'
      AND pg_get_expr(pol.polqual, pol.polrelid)
            ~* '(^|[^.\w])status[[:space:]]*=[[:space:]]*''active'''
  ) AS clubs_select_has_broad_status_active;

-- 5) Table privileges (authenticated / anon) — writers must stay absent
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'clubs'
  AND grantee IN ('authenticated', 'anon', 'PUBLIC')
ORDER BY grantee, privilege_type;

-- 6) public_catalog_list_clubs still present + EXECUTE for anon/authenticated
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'public_catalog_list_clubs';

-- 7) Competing SELECT policies count (expect 1 named clubs_select)
SELECT count(*) AS clubs_select_policy_count
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'clubs'
  AND pol.polcmd = 'r';
