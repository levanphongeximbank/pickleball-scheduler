-- Phase 5D precondition — SELECT/catalog only. Do not mutate.
-- Target must be Staging project_ref qyewbxjsiiyufanzcjcq. Forbidden: expuvcohlcjzvrrauvud.
-- Policy inventory includes WS_COLLAPSE_V1 normalized USING comparison for tt5d_correction_referee_select.

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

SELECT
  pol.polname AS policy_name,
  pol.polcmd::text AS command,
  coalesce(
    (
      SELECT array_agg(r.rolname ORDER BY r.rolname)
      FROM unnest(coalesce(pol.polroles, '{}'::oid[])) AS u(oid)
      LEFT JOIN pg_roles r ON r.oid = u.oid
    ),
    '{}'::name[]
  ) AS roles,
  pg_get_expr(pol.polqual, pol.polrelid, false) AS using_raw,
  btrim(regexp_replace((pg_get_expr(pol.polqual, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g')) AS using_normalized,
  pg_get_expr(pol.polwithcheck, pol.polrelid, false) AS with_check_raw,
  CASE
    WHEN pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL THEN NULL
    ELSE btrim(regexp_replace((pg_get_expr(pol.polwithcheck, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g'))
  END AS with_check_normalized,
  CASE pol.polname
    WHEN 'tt5d_correction_referee_select' THEN
      btrim(regexp_replace((pg_get_expr(pol.polqual, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g')) = btrim(regexp_replace(('(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))')::text, '[[:space:]]+', ' ', 'g'))
    WHEN 'tt5d_correction_no_client_write' THEN
      pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
    ELSE NULL
  END AS using_matches_guard,
  CASE pol.polname
    WHEN 'tt5d_correction_referee_select' THEN
      pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
    WHEN 'tt5d_correction_no_client_write' THEN
      pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
    ELSE NULL
  END AS with_check_matches_guard
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'team_tournament_referee_correction_requests'
  AND pol.polname IN ('tt5d_correction_referee_select', 'tt5d_correction_no_client_write')
ORDER BY pol.polname;
