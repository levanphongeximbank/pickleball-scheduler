-- 99_TT5D_VERIFY.sql — catalog/SELECT-only. No DML/DDL.
-- Phase 5C: used for documentation of expected contracts; apply was NOT executed.

SELECT to_regclass('public.team_tournament_referee_correction_requests') AS correction_table;
SELECT to_regclass('public.team_sub_match_referee_links') AS tt5b_links;
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='referee_assignments' AND column_name='version'
) AS has_version_col;
SELECT EXISTS (
  SELECT 1 FROM pg_constraint c
  JOIN pg_class t ON t.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public' AND t.relname='referee_assignments'
    AND c.conname='referee_assignments_status_check'
) AS has_status_check;
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'team_tournament_create_referee_assignment',
    'team_tournament_reopen_referee_match',
    'team_tournament_request_referee_correction',
    'referee_v5_assert_assignment_write'
  )
ORDER BY 1,2;
