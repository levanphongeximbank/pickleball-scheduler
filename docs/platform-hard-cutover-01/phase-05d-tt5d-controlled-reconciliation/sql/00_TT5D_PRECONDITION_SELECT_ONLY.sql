-- Phase 5D-A precondition — SELECT/catalog only. Do not mutate.
-- Target must be Staging project_ref qyewbxjsiiyufanzcjcq. Forbidden: expuvcohlcjzvrrauvud.

SELECT to_regclass('public.club_ai_data') IS NULL AS club_ai_data_absent;
SELECT to_regclass('public.referee_assignments') IS NOT NULL AS referee_assignments_present;
SELECT to_regclass('public.team_tournament_referee_correction_requests') IS NOT NULL AS correction_table_present;

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_args,
       CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END AS volatility,
       md5(pg_get_functiondef(p.oid)) AS def_md5,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'referee_v5_assignment_effective_status',
    'referee_v5_mark_assignment_expired_if_needed',
    'team_tournament_create_referee_assignment',
    'team_tournament_revoke_referee_assignment',
    'team_tournament_list_referee_assignments',
    'referee_v5_apply_admin_result_revision',
    'team_tournament_reopen_referee_match',
    'team_tournament_request_referee_correction',
    'team_tournament_review_referee_correction',
    'team_tournament_list_referee_corrections',
    'referee_v5_current_user_has_assignment',
    'referee_v5_assert_assignment_write',
    'team_tournament_referee_match_access_ops'
  )
ORDER BY 1, 2;

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%tt5d%' OR name ILIKE '%phase5c%' OR name ILIKE '%phase5d%' OR name ILIKE '%tt5%'
ORDER BY version;
