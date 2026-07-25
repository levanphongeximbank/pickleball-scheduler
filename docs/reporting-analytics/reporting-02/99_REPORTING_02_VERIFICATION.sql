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

-- Permission catalog (expect exact 10 reporting.* ids from REPORTING-01 SoT)
DO $$
DECLARE
  missing text := '';
  pid text;
BEGIN
  FOREACH pid IN ARRAY ARRAY[
    'reporting.dashboard.view',
    'reporting.report.execute',
    'reporting.field.sensitive.view',
    'reporting.report.save',
    'reporting.filter.save',
    'reporting.report.export',
    'reporting.scope.cross_tenant',
    'reporting.scope.tenant',
    'reporting.scope.venue',
    'reporting.scope.club'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = pid) THEN
      missing := missing || pid || ';';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'REPORTING-02 verification failed: missing permission catalog ids: %', missing;
  END IF;

  RAISE NOTICE 'REPORTING-02 verification passed (permission catalog — 10 ids)';
END $$;

-- Role grants for reporting.* must remain fail-closed until Owner matrix (expect 0 unless Owner applied separately)
SELECT count(*) AS reporting_role_permission_rows
FROM public.role_permissions rp
WHERE rp.permission_id LIKE 'reporting.%';

-- Policy inventory (expect SELECT policies only; no write policies)
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'reporting_%'
ORDER BY tablename, policyname;
