-- Court Operations legacy isolation 01 — court_clusters tenant/venue semantics.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- LEGACY_ISOLATION_MIGRATION_VERSION=20260816220000
-- Additive Batch 8. Does not edit Phase 3A / 3B / D4 / Batch1–7 certified SQL files.

DO $$
DECLARE
  v_missing text[] := '{}';
BEGIN
  IF to_regclass('public.court_clusters') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_clusters');
  END IF;
  IF to_regclass('public.venues') IS NULL THEN
    v_missing := array_append(v_missing, 'public.venues');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;
  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.is_super_admin()');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_venue_id()');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing required prerequisite objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- venue_id must remain present (2.1 venue FK / identity).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'venue_id'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL court_clusters.venue_id missing or wrong type';
  END IF;

  -- Fail closed if any cluster venue_id cannot be proven against venues.
  IF EXISTS (
    SELECT 1
    FROM public.court_clusters cc
    WHERE NOT EXISTS (
      SELECT 1 FROM public.venues v WHERE v.id = cc.venue_id
    )
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL unresolved court_clusters.venue_id → venues mapping';
  END IF;
END $$;
