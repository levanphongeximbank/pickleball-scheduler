-- =============================================================================
-- PUBLIC-CATALOG-01 — Boundary verification (run AFTER staging apply)
-- =============================================================================

-- 1) RPCs exist and are SECURITY DEFINER
SELECT p.proname, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('public_catalog_list_clubs', 'public_catalog_list_courts');

-- 2) anon has EXECUTE only (not table SELECT on projection)
SELECT has_function_privilege('anon', 'public.public_catalog_list_clubs(integer, integer, text)', 'EXECUTE') AS anon_clubs_exec;
SELECT has_function_privilege('anon', 'public.public_catalog_list_courts(integer, integer, text, text)', 'EXECUTE') AS anon_courts_exec;
SELECT has_table_privilege('anon', 'public.public_catalog_courts', 'SELECT') AS anon_courts_table_select; -- expect false
SELECT has_table_privilege('anon', 'public.clubs', 'SELECT') AS anon_clubs_table_select; -- expect false under hardened RLS

-- 3) Deny-by-default: unlisted clubs do not appear
-- (seed a listed vs unlisted club in a controlled staging harness before asserting)

SELECT * FROM public.public_catalog_list_clubs(20, 0, 'name_asc');
SELECT * FROM public.public_catalog_list_courts(20, 0, 'name_asc', NULL);

-- 4) Malformed pagination must fail (expect error)
-- SELECT * FROM public.public_catalog_list_clubs(999, 0, 'name_asc');
-- SELECT * FROM public.public_catalog_list_clubs(20, -1, 'name_asc');
-- SELECT * FROM public.public_catalog_list_clubs(20, 0, 'name_desc');
