-- =============================================================================
-- REPORTING-02 — Verification (read-only)
-- Purpose: Assert authored schema objects exist with expected security posture.
-- Status: AUTHORED ONLY — safe to run after apply; does not mutate data.
-- Does NOT apply migrations. Does NOT connect to Staging/Production by itself.
-- =============================================================================

SET search_path = public, pg_temp;

DO $$
DECLARE
  missing text := '';
  t text;
  bad text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'reporting_report_definitions',
    'reporting_saved_reports',
    'reporting_saved_filters',
    'reporting_executions',
    'reporting_export_jobs'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      missing := missing || t || ';';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'REPORTING-02 verification failed: missing tables: %', missing;
  END IF;

  SELECT string_agg(c.relname, ', ')
    INTO bad
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'reporting_report_definitions',
      'reporting_saved_reports',
      'reporting_saved_filters',
      'reporting_executions',
      'reporting_export_jobs'
    )
    AND c.relkind = 'r'
    AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'REPORTING-02 verification failed: RLS not FORCE-enabled on %', bad;
  END IF;

  IF to_regprocedure('public.reporting_02_scope_allows(text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'REPORTING-02 verification failed: scope helper missing';
  END IF;

  RAISE NOTICE 'REPORTING-02 verification passed (tables + FORCE RLS + scope helper)';
END $$;

-- Policy inventory (expect SELECT policies only; no write policies)
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'reporting_%'
ORDER BY tablename, policyname;
