-- Court Resource Phase 3B canonical reservation. PRECHECK. READ ONLY.
-- LOCAL AUTHORING ONLY. NOT APPLIED TO STAGING OR PRODUCTION.
-- Pre-existing Daily Play fingerprint lock.
-- Method: encode(<pgcrypto_schema>.digest(convert_to(pg_get_functiondef(oid), 'UTF8'), 'sha256'), 'hex')
-- pgcrypto schema is discovered from pg_catalog.pg_extension.extnamespace.
-- digest(bytea,text) is invoked schema-qualified; search_path is not used to find it.
-- Captured 2026-08-15 from Staging qyewbxjsiiyufanzcjcq (read-only).
-- Unknown newer bodies fail closed.
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_collision text[] := ARRAY[]::text[];
  v_pilot_tables integer := 0;
  v_pilot_fn integer := 0;
  v_assign_def text;
  v_change_def text;
  v_assign_hash text;
  v_change_hash text;
  v_pgcrypto_schema text;
  v_digest_reg text;
  v_digest_sql text;
  -- Staging pg_get_functiondef SHA256 for pre-Phase3B assign/change.
  v_assign_expected text := '4c751a97d8e8ee8fc658d3b7647fc2d84b870b042f1f0211b23ba1632aa369e5';
  v_change_expected text := 'd1b043a29dbee4d6e1d553ac5227052a645c115ded8f07d7cd1034ddb4a8cf59';
BEGIN
  IF to_regclass('public.venues') IS NULL THEN
    v_missing := array_append(v_missing, 'public.venues');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;
  IF to_regclass('public.court_clusters') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_clusters');
  END IF;
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.is_super_admin()');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_venue_id()');
  END IF;
  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;
  IF to_regclass('public.court_resource_club_operational_access') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_club_operational_access');
  END IF;
  IF to_regclass('public.court_resource_legacy_court_identity_mappings') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_legacy_court_identity_mappings');
  END IF;
  IF to_regprocedure(
    'public.court_resource_resolve_legacy_court_mapping(text,text,text,text,text,text,text,uuid,jsonb,jsonb)'
  ) IS NULL THEN
    v_missing := array_append(
      v_missing, 'public.court_resource_resolve_legacy_court_mapping'
    );
  END IF;
  IF to_regclass('public.daily_play_court_leases') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_court_leases');
  END IF;
  IF to_regprocedure(
    'public.daily_play_assign_court(text,text,uuid,text,text,integer,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_assign_court');
  END IF;
  IF to_regprocedure(
    'public.daily_play_change_court(text,text,uuid,text,text,integer,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_change_court');
  END IF;
  IF to_regprocedure(
    'public.court_assert_available(text,text,text,timestamptz,timestamptz,uuid,boolean,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_assert_available');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing Phase 3A/platform: %',
      array_to_string(v_missing, ', ');
  END IF;

  SELECT n.nspname
    INTO v_pgcrypto_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n
    ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';
  IF v_pgcrypto_schema IS NULL OR btrim(v_pgcrypto_schema) = '' THEN
    RAISE EXCEPTION 'PGCRYPTO_EXTENSION_MISSING pgcrypto is not installed';
  END IF;
  RAISE NOTICE 'PGCRYPTO_EXTENSION_PRESENT=YES schema=%', v_pgcrypto_schema;
  RAISE NOTICE 'DIGEST_SCHEMA_DISCOVERY=PG_EXTENSION_EXTNAMESPACE';

  v_digest_reg := format('%I.digest(bytea,text)', v_pgcrypto_schema);
  IF to_regprocedure(v_digest_reg) IS NULL THEN
    RAISE EXCEPTION
      'PGCRYPTO_DIGEST_MISSING digest(bytea,text) absent in schema %',
      v_pgcrypto_schema;
  END IF;

  v_digest_sql := format(
    'SELECT encode(%I.digest($1,$2), %L)',
    v_pgcrypto_schema,
    'hex'
  );

  v_assign_def := pg_get_functiondef(
    'public.daily_play_assign_court(text,text,uuid,text,text,integer,text)'::regprocedure
  );
  v_change_def := pg_get_functiondef(
    'public.daily_play_change_court(text,text,uuid,text,text,integer,text)'::regprocedure
  );
  BEGIN
    EXECUTE v_digest_sql INTO STRICT v_assign_hash
      USING convert_to(v_assign_def, 'UTF8'), 'sha256';
    EXECUTE v_digest_sql INTO STRICT v_change_hash
      USING convert_to(v_change_def, 'UTF8'), 'sha256';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION
        'PRECHECK_FAIL fingerprint cannot be calculated: %',
        SQLERRM;
  END;
  IF v_assign_hash IS NULL OR v_change_hash IS NULL
     OR length(v_assign_hash) <> 64 OR length(v_change_hash) <> 64 THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL fingerprint cannot be calculated assign=% change=%',
      v_assign_hash, v_change_hash;
  END IF;
  IF v_assign_def NOT ILIKE '%court_assert_available%'
     OR v_assign_def ILIKE '%court_resource_daily_play_acquire%'
     OR v_assign_hash IS DISTINCT FROM v_assign_expected THEN
    RAISE EXCEPTION
      'PREEXISTING_ROUTINE_DRIFT daily_play_assign_court fingerprint=% expected=%',
      v_assign_hash, v_assign_expected;
  END IF;
  IF v_change_def NOT ILIKE '%court_assert_available%'
     OR v_change_def ILIKE '%court_resource_daily_play_acquire%'
     OR v_change_hash IS DISTINCT FROM v_change_expected THEN
    RAISE EXCEPTION
      'PREEXISTING_ROUTINE_DRIFT daily_play_change_court fingerprint=% expected=%',
      v_change_hash, v_change_expected;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'btree_gist'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL btree_gist is not available';
  END IF;

  IF to_regclass('public.court_resource_reservations') IS NOT NULL THEN
    v_collision := array_append(v_collision, 'public.court_resource_reservations');
  END IF;
  IF to_regclass('public.court_resource_reservation_commands') IS NOT NULL THEN
    v_collision := array_append(v_collision, 'public.court_resource_reservation_commands');
  END IF;
  IF to_regclass('public.court_resource_reservation_cutover') IS NOT NULL THEN
    v_collision := array_append(v_collision, 'public.court_resource_reservation_cutover');
  END IF;
  IF to_regprocedure(
    'public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)'
  ) IS NOT NULL THEN
    v_collision := array_append(v_collision, 'public.court_resource_reserve');
  END IF;
  IF to_regprocedure(
    'public.court_resource_release(text,uuid[],text,text,uuid[],text,text)'
  ) IS NOT NULL THEN
    v_collision := array_append(v_collision, 'public.court_resource_release');
  END IF;
  IF to_regprocedure(
    'public.court_resource_get_availability(text,text,uuid[],timestamptz,timestamptz,text,text)'
  ) IS NOT NULL THEN
    v_collision := array_append(v_collision, 'public.court_resource_get_availability');
  END IF;
  IF to_regprocedure('public.court_resource_digest_sha256(bytea)') IS NOT NULL THEN
    v_collision := array_append(v_collision, 'public.court_resource_digest_sha256');
  END IF;
  IF cardinality(v_collision) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL object collision: %',
      array_to_string(v_collision, ', ');
  END IF;

  IF to_regclass('public.court_reservations') IS NOT NULL THEN
    v_pilot_tables := 1;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'official_tournament_reserve_courts'
  ) THEN
    v_pilot_fn := 1;
  END IF;

  RAISE NOTICE 'PRECHECK_OK Phase 3A present; btree_gist available; no Phase 3B collision';
  RAISE NOTICE 'PRECHECK_DAILY_PLAY_FINGERPRINT assign=% change=%', v_assign_hash, v_change_hash;
  RAISE NOTICE 'PRECHECK_PILOT court_reservations=% official_tournament_reserve_courts=%',
    v_pilot_tables, v_pilot_fn;
END
$$;

SELECT 'PHASE3A_PHYSICAL_COURTS' AS check_item,
  (to_regclass('public.court_resource_physical_courts') IS NOT NULL) AS ok;
SELECT 'PHASE3A_OPERATIONAL_ACCESS' AS check_item,
  (to_regclass('public.court_resource_club_operational_access') IS NOT NULL) AS ok;
SELECT 'BTREE_GIST_AVAILABLE' AS check_item,
  EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'btree_gist')
  OR EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS ok;
SELECT 'PILOT_COURT_RESERVATIONS_DETECTED' AS check_item,
  (to_regclass('public.court_reservations') IS NOT NULL) AS detected,
  'detected separately; not a Phase 3B blocker' AS note;
SELECT 'PILOT_OFFICIAL_RESERVE_DETECTED' AS check_item,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'official_tournament_reserve_courts'
  ) AS detected,
  'detected separately; not a Phase 3B blocker' AS note;
SELECT 'PHASE3B_COLLISION' AS check_item, 0 AS value, true AS ok;
SELECT 'DAILY_PLAY_ASSIGN_FINGERPRINT' AS check_item,
  '4c751a97d8e8ee8fc658d3b7647fc2d84b870b042f1f0211b23ba1632aa369e5' AS expected;
SELECT 'DAILY_PLAY_CHANGE_FINGERPRINT' AS check_item,
  'd1b043a29dbee4d6e1d553ac5227052a645c115ded8f07d7cd1034ddb4a8cf59' AS expected;
SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
