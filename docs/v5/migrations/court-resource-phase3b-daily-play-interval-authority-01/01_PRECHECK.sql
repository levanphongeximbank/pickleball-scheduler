-- Court Resource Phase 3B/4D Daily Play interval authority.
-- READ-ONLY PRECHECK. LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING/PRODUCTION HERE.
-- Requires Phase 3B schema installed. Requires SQL cutover=false before patch.

DO $$
DECLARE
  v_missing text[] := '{}';
  v_cutover boolean;
  v_acquire_hash text;
  v_pgcrypto_schema text;
  v_acquire_def text;
  v_expected_staging text :=
    '161d3dcc6827cee609fa86e24914abf73937d4362583014f38f06ca648622b34';
  -- Local Phase3B package apply (LF) may differ from Staging pg_get_functiondef (CRLF).
  v_expected_phase3b_package text :=
    '973df28374db059755c88c0e9f2df78f1986bbc08c0be907b538a213a4a6b7b4';
BEGIN
  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_reservations');
  END IF;
  IF to_regclass('public.court_resource_reservation_cutover') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_reservation_cutover');
  END IF;
  IF to_regclass('public.daily_play_court_leases') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_court_leases');
  END IF;
  IF to_regprocedure(
    'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_daily_play_acquire');
  END IF;
  IF to_regprocedure(
    'public.court_resource_reserve_core(text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_reserve_core');
  END IF;
  IF to_regclass('public.venues') IS NULL THEN
    v_missing := array_append(v_missing, 'public.venues');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing Phase3B/Daily Play objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  SELECT enabled INTO v_cutover
  FROM public.court_resource_reservation_cutover
  WHERE cutover_id = 'canonical-reservation-phase3b';

  IF v_cutover IS NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing cutover row canonical-reservation-phase3b';
  END IF;
  IF v_cutover IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PRECHECK_FAIL SQL cutover must be false before 4D patch (enabled=%)',
      v_cutover;
  END IF;

  IF to_regclass('public.daily_play_court_capacity_windows') IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL 4D capacity windows already present — refuse re-apply drift';
  END IF;

  SELECT n.nspname INTO v_pgcrypto_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto'
  LIMIT 1;

  IF v_pgcrypto_schema IS NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL PGCRYPTO_EXTENSION_MISSING';
  END IF;

  IF to_regprocedure(format('%I.digest(bytea,text)', v_pgcrypto_schema)) IS NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL PGCRYPTO_DIGEST_MISSING schema=%', v_pgcrypto_schema;
  END IF;

  v_acquire_def := pg_get_functiondef(
    'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'::regprocedure
  );

  IF v_acquire_def IS NULL
     OR v_acquire_def NOT ILIKE '%now() + interval ''12 hours''%' THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL acquire missing pre-4D arbitrary now()+12h marker (unknown drift)';
  END IF;

  EXECUTE format(
    'SELECT encode(%I.digest(convert_to($1, ''UTF8''), ''sha256''), ''hex'')',
    v_pgcrypto_schema
  )
  INTO v_acquire_hash
  USING v_acquire_def;

  IF v_acquire_hash IS DISTINCT FROM v_expected_staging
     AND v_acquire_hash IS DISTINCT FROM v_expected_phase3b_package THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL PREEXISTING_ROUTINE_DRIFT court_resource_daily_play_acquire fingerprint=% expected_staging=% expected_phase3b_package=%',
      v_acquire_hash, v_expected_staging, v_expected_phase3b_package;
  END IF;

  RAISE NOTICE 'PRECHECK_OK Phase3B present; cutover=false; acquire fingerprint=%',
    v_acquire_hash;
END
$$;

SELECT 'PHASE3B_SCHEMA' AS check_item,
  (to_regclass('public.court_resource_reservations') IS NOT NULL) AS ok;
SELECT 'SQL_CUTOVER_FALSE' AS check_item,
  EXISTS (
    SELECT 1 FROM public.court_resource_reservation_cutover
    WHERE cutover_id = 'canonical-reservation-phase3b' AND enabled = false
  ) AS ok;
SELECT 'ACQUIRE_PRE4D_FINGERPRINT_STAGING' AS check_item,
  '161d3dcc6827cee609fa86e24914abf73937d4362583014f38f06ca648622b34' AS expected;
SELECT 'ACQUIRE_PRE4D_FINGERPRINT_PHASE3B_PACKAGE' AS check_item,
  '973df28374db059755c88c0e9f2df78f1986bbc08c0be907b538a213a4a6b7b4' AS expected;
SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
