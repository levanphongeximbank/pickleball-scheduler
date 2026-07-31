-- M9 verify (SELECT/catalog-only) — Team Tournament remainder TT2B–TT6B
-- Does not read row payloads / PII.

-- Tables / RLS
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (
    c.relname LIKE 'team_tournament%'
    OR c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox','team_tournament_referee_correction_requests')
  )
ORDER BY 1;

-- Columns (sanitized names/types only)
SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS typ
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY 1, a.attnum;

-- Indexes
SELECT c.relname AS table_name, i.relname AS index_name
FROM pg_index x
JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox')
ORDER BY 1, 2;

-- Policies
SELECT c.relname, pol.polname, pol.polcmd
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox','team_tournament_referee_correction_requests')
ORDER BY 1, 2;

-- Functions (identity args + return + search_path + security definer)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       coalesce(p.proconfig::text, '') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE 'team_tournament%'
    OR p.proname LIKE 'tt6b%'
  )
ORDER BY 1, 2;

-- Tenant / SECURITY DEFINER assertions (fail rows are non-empty when unsafe)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, coalesce(p.proconfig::text,'') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proname LIKE 'team_tournament%'
  AND (
    coalesce(p.proconfig::text,'') = ''
    OR p.proconfig::text !~* 'search_path'
  )
ORDER BY 1, 2;

-- Grants (role names only)
SELECT p.proname, r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname IN (
    'team_tournament_get_setup',
    'team_tournament_provision_referee_match',
    'team_tournament_consume_referee_v5_outbox'
  )
  AND r.rolname IN ('anon','authenticated','service_role')
ORDER BY 1, 2;
