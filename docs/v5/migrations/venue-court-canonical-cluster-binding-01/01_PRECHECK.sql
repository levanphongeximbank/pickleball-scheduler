-- Venue/Court canonical cluster membership binding — dependency precheck.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- This script is read-only. STAGING_MUTATIONS=0. PRODUCTION_MUTATIONS=0.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_club_cols text;
  v_blob_cols text;
  v_cluster_cols text;
  v_club_update_count int;
BEGIN
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;
  IF to_regclass('public.club_data_v3') IS NULL THEN
    v_missing := array_append(v_missing, 'public.club_data_v3');
  END IF;
  IF to_regclass('public.court_clusters') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_clusters');
  END IF;

  IF to_regprocedure('public.phase42_err(text, text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.phase42_err(text, text)');
  END IF;
  IF to_regprocedure('public.phase42_can_update_club(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.phase42_can_update_club(text)');
  END IF;
  IF to_regprocedure('public.phase42_idempotency_get(uuid, text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.phase42_idempotency_get(uuid, text)');
  END IF;
  IF to_regprocedure('public.phase42_idempotency_put(uuid, text, text, text, jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.phase42_idempotency_put(uuid, text, text, text, jsonb)');
  END IF;
  IF to_regprocedure('public.phase42_write_audit(text, text, text, text, text, jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.phase42_write_audit(text, text, text, text, text, jsonb)');
  END IF;
  IF to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.club_update(uuid, text, integer, text, text, text, text, text)');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: missing canonical cluster-binding dependencies: %',
      array_to_string(v_missing, ', ');
  END IF;

  SELECT string_agg(column_name, ',' ORDER BY column_name) INTO v_club_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'clubs'
    AND column_name IN ('id', 'tenant_id', 'registered_cluster_id', 'version', 'deleted_at');
  IF v_club_cols IS NULL
     OR v_club_cols NOT LIKE '%id%'
     OR v_club_cols NOT LIKE '%registered_cluster_id%'
     OR v_club_cols NOT LIKE '%tenant_id%'
     OR v_club_cols NOT LIKE '%version%' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: public.clubs missing registered_cluster_id/version/tenant_id contract: %',
      coalesce(v_club_cols, '<none>');
  END IF;

  SELECT string_agg(column_name, ',' ORDER BY column_name) INTO v_blob_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'club_data_v3'
    AND column_name IN ('club_id', 'venue_id', 'data', 'version', 'synced_at');
  IF v_blob_cols IS NULL
     OR v_blob_cols NOT LIKE '%club_id%'
     OR v_blob_cols NOT LIKE '%data%'
     OR v_blob_cols NOT LIKE '%version%' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: public.club_data_v3 missing club_id/data/version contract: %',
      coalesce(v_blob_cols, '<none>');
  END IF;

  SELECT string_agg(column_name, ',' ORDER BY column_name) INTO v_cluster_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'court_clusters'
    AND column_name IN ('id', 'venue_id', 'status');
  IF v_cluster_cols IS NULL
     OR v_cluster_cols NOT LIKE '%id%'
     OR v_cluster_cols NOT LIKE '%venue_id%'
     OR v_cluster_cols NOT LIKE '%status%' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: public.court_clusters missing id/venue_id/status contract: %',
      coalesce(v_cluster_cols, '<none>');
  END IF;

  SELECT count(*) INTO v_club_update_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_update';
  IF v_club_update_count < 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: public.club_update missing';
  END IF;

  -- Current writers are split: clubs.registered_cluster_id via club_update,
  -- physical court clusterId via club_data_v3 JSON. This package adds one
  -- atomic shared binder. It must not already exist with a drifted overload.
  IF (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'bind_club_courts_to_cluster'
  ) > 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: bind_club_courts_to_cluster already has unexpected overloads';
  END IF;
END
$$;
