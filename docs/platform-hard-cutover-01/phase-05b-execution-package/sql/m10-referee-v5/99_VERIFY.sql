-- M10 verify (SELECT/catalog-only) — Referee V5
-- Distinguishes legacy token RPCs from referee_v5_* objects.

-- Legacy token RPCs must remain present (not deleted by M10)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('referee_get_match_by_token','referee_update_match_score')
ORDER BY 1, 2;

-- Referee V5 tables + RLS
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (
    'referee_assignments','match_live_states','match_participant_positions','match_events',
    'match_game_states','match_result_revisions','match_incidents','match_disputes',
    'referee_device_sessions','match_sync_mutations','match_integration_outbox'
  )
ORDER BY 1;

-- Policies
SELECT c.relname, pol.polname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (c.relname LIKE 'match_%' OR c.relname LIKE 'referee_%')
ORDER BY 1, 2;

-- referee_v5 functions: args, returns, search_path, security definer
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       coalesce(p.proconfig::text, '') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'referee_v5%'
ORDER BY 1, 2;

-- Unsafe search_path on SECURITY DEFINER (expect 0 rows)
SELECT p.proname, coalesce(p.proconfig::text,'') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'referee_v5%'
  AND p.prosecdef = true
  AND (coalesce(p.proconfig::text,'') = '' OR p.proconfig::text !~* 'search_path')
ORDER BY 1;

-- Grants
SELECT p.proname, r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname LIKE 'referee_v5%'
  AND r.rolname IN ('anon','authenticated','service_role')
ORDER BY 1, 2;
