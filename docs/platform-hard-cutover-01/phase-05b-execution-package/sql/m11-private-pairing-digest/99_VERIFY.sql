-- M11 verify (SELECT/catalog-only)
-- Assert extensions.digest body, search_path, SECURITY DEFINER, grants, RC1 objects preserved.

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       coalesce(p.proconfig::text, '') AS proconfig,
       md5(pg_get_functiondef(p.oid)) AS def_md5,
       (pg_get_functiondef(p.oid) LIKE '%extensions.digest%') AS uses_extensions_digest,
       (pg_get_functiondef(p.oid) !~* 'digest\([^)]+\)' OR pg_get_functiondef(p.oid) LIKE '%extensions.digest%') AS digest_qualified
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'private_pairing_compute_rule_set_hash'
  AND pg_get_function_identity_arguments(p.oid) = 'p_rule_set_id uuid';

-- Expect def_md5 = 0be77671f95c52b1d5e00496bee2adf1
-- Expect search_path includes public, pg_temp
-- Expect SECURITY DEFINER = true

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'private_pairing_%'
ORDER BY 1;

SELECT pol.polname, c.relname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'private_pairing_%'
ORDER BY 2, 1;

SELECT r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname = 'private_pairing_compute_rule_set_hash'
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY 1;
