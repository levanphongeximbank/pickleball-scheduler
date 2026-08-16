-- Court Operations pre-Staging identity-guard correction 01.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- IDENTITY_GUARD_CORRECTION_MIGRATION_VERSION=20260816190000
-- Depends on: Phase3A identity_guard + Batch8 court_clusters.tenant_id.

DO $$
DECLARE
  v_missing text[] := '{}';
BEGIN
  IF to_regprocedure('public.court_resource_identity_guard()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_identity_guard()');
  END IF;
  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;
  IF to_regclass('public.court_clusters') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_clusters');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing required prerequisite objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- Batch8 cluster tenant semantics must already be present.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'tenant_id'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL court_clusters.tenant_id missing/nullable — apply Batch8 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'venue_id'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL court_clusters.venue_id missing';
  END IF;

  -- Trigger bindings must still point at the Phase3A guard function name.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'court_resource_physical_courts'
      AND t.tgname = 'trg_court_resource_physical_courts_guard'
      AND NOT t.tgisinternal
      AND p.proname = 'court_resource_identity_guard'
  ) THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL trg_court_resource_physical_courts_guard not bound to identity_guard';
  END IF;
END $$;
