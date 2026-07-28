-- M8 verify (read-only)
-- Confirms competition_ssot_* tables, RLS, finalize RPC, and text tenant_id types.

SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'competition_ssot_%'
ORDER BY 1;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'competition_ssot_%'
ORDER BY 1, 2;

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'competition_ssot_%' AND c.relkind = 'r'
ORDER BY 1;

-- FAIL signal: any tenant_id that is not text
SELECT c.relname AS table_name, format_type(a.atttypid, a.atttypmod) AS tenant_id_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'competition_ssot_%'
  AND a.attname = 'tenant_id'
  AND NOT a.attisdropped
  AND format_type(a.atttypid, a.atttypmod) <> 'text'
ORDER BY 1;

-- Expect finalize writer with text p_tenant_id (no uuid-first arg)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'competition_ssot_finalize_match_result'
ORDER BY 2;
