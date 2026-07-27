-- PROD-SEC-G3-B12-01 — Post-apply verification (read-only)
-- Run after 10_CLUB_AI_DATA_ANON_WRITE_LOCKDOWN.sql on Staging/Production.
-- Do NOT insert/update/delete as anon.

-- A) Policies: no anon INSERT/UPDATE/SELECT permissive true policies
SELECT pol.polname,
       CASE pol.polcmd
         WHEN 'r' THEN 'SELECT'
         WHEN 'a' THEN 'INSERT'
         WHEN 'w' THEN 'UPDATE'
         WHEN 'd' THEN 'DELETE'
         WHEN '*' THEN 'ALL'
       END AS cmd,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'club_ai_data'
ORDER BY 1;

-- Expect: only club_ai_data_deny_all_clients (RESTRICTIVE, USING false / WITH CHECK false)
-- Expect: ZERO rows named club_ai_data_anon_*

-- B) Grants: anon/authenticated must have no DML privileges
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'club_ai_data'
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY 1, 2;

-- Expect: zero rows (or no INSERT/UPDATE/DELETE/SELECT)

-- C) RLS flags
SELECT c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'club_ai_data';

-- Expect: rls_enabled=true, rls_forced=true

-- D) Public Catalog RPCs untouched
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'public_catalog_list_%'
ORDER BY 1;

-- Expect: public_catalog_list_clubs/courts/tournaments/rankings still present

-- E) club_data_v3 policies still present (canonical writer)
SELECT pol.polname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'club_data_v3'
ORDER BY 1;

-- Expect: club_data_v3_member_* policies unchanged
