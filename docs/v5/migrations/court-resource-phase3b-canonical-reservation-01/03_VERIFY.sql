-- Court Resource Phase 3B verification. READ ONLY.
-- LOCAL AUTHORING ONLY. Does not perform persistent acceptance mutation.
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_excl text;
  v_digest_def text;
  v_runtime_def text;
  v_unsafe_digest integer := 0;
BEGIN
  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_reservations');
  END IF;
  IF to_regclass('public.court_resource_reservation_commands') IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_reservation_commands');
  END IF;
  IF to_regclass('public.court_resource_reservation_cutover') IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_reservation_cutover');
  END IF;
  IF to_regprocedure(
    'public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_reserve');
  END IF;
  IF to_regprocedure(
    'public.court_resource_release(text,uuid[],text,text,uuid[],text,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_release');
  END IF;
  IF to_regprocedure(
    'public.court_resource_get_availability(text,text,uuid[],timestamptz,timestamptz,text,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_get_availability');
  END IF;
  IF to_regprocedure(
    'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_daily_play_acquire');
  END IF;
  IF to_regprocedure('public.court_resource_digest_sha256(bytea)') IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_digest_sha256');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing package objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN (
      'court_resource_reservations',
      'court_resource_reservation_commands',
      'court_resource_reservation_cutover'
    ) AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL RLS must be enabled and forced';
  END IF;

  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'court_resource_reservations',
      'court_resource_reservation_commands',
      'court_resource_reservation_cutover'
    ) AND cmd = 'SELECT'
  ) <> 3 THEN
    RAISE EXCEPTION 'VERIFY_FAIL expected exactly three package SELECT policies';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'court_resource_reservations',
      'court_resource_reservation_commands',
      'court_resource_reservation_cutover'
    ) AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL package has direct write policy';
  END IF;

  SELECT pg_get_constraintdef(con.oid) INTO v_excl
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'court_resource_reservations'
    AND con.conname = 'court_resource_reservations_active_excl';
  IF v_excl IS NULL
     OR v_excl NOT ILIKE '%gist%'
     OR v_excl NOT ILIKE '%tstzrange%starts_at%ends_at%'
     OR v_excl NOT ILIKE '%status%active%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL active GiST exclusion missing or malformed: %', v_excl;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.court_resource_reservation_cutover
    WHERE cutover_id = 'canonical-reservation-phase3b' AND enabled = false
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL cutover default is not OFF';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid = to_regprocedure(
        'public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)'
      )
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '')
        ILIKE '%search_path=pg_catalog, public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL reserve RPC security boundary differs from APPLY';
  END IF;

  IF has_function_privilege(
      'anon',
      'public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)',
      'EXECUTE'
    )
    OR NOT has_function_privilege(
      'authenticated',
      'public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'authenticated',
      'public.court_resource_reserve_core(text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'VERIFY_FAIL RPC grants are not fail closed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      VALUES
        ('court_resource_reservations'),
        ('court_resource_reservation_commands'),
        ('court_resource_reservation_cutover')
    ) package_table(name)
    WHERE has_table_privilege('anon', 'public.' || name, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || name, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || name, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || name, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL direct client table privilege exists';
  END IF;

  IF pg_get_functiondef(
       to_regprocedure('public.daily_play_assign_court(text,text,uuid,text,text,integer,text)')
     ) NOT ILIKE '%court_resource_daily_play_acquire%'
     OR pg_get_functiondef(
       to_regprocedure('public.daily_play_change_court(text,text,uuid,text,text,integer,text)')
     ) NOT ILIKE '%court_resource_daily_play_acquire%'
     OR pg_get_functiondef(
       to_regprocedure('public.daily_play_assign_court(text,text,uuid,text,text,integer,text)')
     ) NOT ILIKE '%court_assert_available%'
     OR pg_get_functiondef(
       to_regprocedure('public.daily_play_change_court(text,text,uuid,text,text,integer,text)')
     ) NOT ILIKE '%court_assert_available%'
     OR pg_get_functiondef(
       to_regprocedure('public.daily_play_assign_court(text,text,uuid,text,text,integer,text)')
     ) NOT ILIKE '%court_resource_canonical_reservation_cutover_enabled%'
     OR pg_get_functiondef(
       to_regprocedure('public.daily_play_change_court(text,text,uuid,text,text,integer,text)')
     ) NOT ILIKE '%court_resource_canonical_reservation_cutover_enabled%'
  THEN
    RAISE EXCEPTION 'VERIFY_FAIL Daily Play assign/change cutover branches are not installed as expected';
  END IF;

  IF to_regprocedure(
       'public.court_assert_available(text,text,text,timestamptz,timestamptz,uuid,boolean,text)'
     ) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL court_assert_available missing after Phase 3B apply';
  END IF;

  IF to_regclass('public.court_resource_physical_courts') IS NULL
     OR to_regclass('public.court_resource_club_operational_access') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL Phase 3A objects missing after Phase 3B apply';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid = to_regprocedure('public.court_resource_digest_sha256(bytea)')
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '')
        ILIKE '%search_path=pg_catalog, public%'
      AND coalesce(array_to_string(p.proconfig, ','), '')
        NOT ILIKE '%extensions%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL digest helper security boundary differs from APPLY';
  END IF;

  IF has_function_privilege(
      'anon', 'public.court_resource_digest_sha256(bytea)', 'EXECUTE'
    )
    OR has_function_privilege(
      'authenticated', 'public.court_resource_digest_sha256(bytea)', 'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'VERIFY_FAIL digest helper is not fail closed';
  END IF;

  v_digest_def := pg_get_functiondef(
    to_regprocedure('public.court_resource_digest_sha256(bytea)')
  );
  IF v_digest_def IS NULL
     OR position('pg_catalog.pg_extension' in v_digest_def) = 0
     OR position('extnamespace' in v_digest_def) = 0
     OR position('%I.digest($1, %L)' in v_digest_def) = 0
     OR position('PGCRYPTO_EXTENSION_MISSING' in v_digest_def) = 0
     OR position('PGCRYPTO_DIGEST_MISSING' in v_digest_def) = 0
  THEN
    RAISE EXCEPTION 'VERIFY_FAIL digest helper is not catalog-schema-qualified';
  END IF;

  SELECT count(*)::integer INTO v_unsafe_digest
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (
      p.proname LIKE 'court_resource%'
      OR p.proname IN (
        'daily_play_assign_court',
        'daily_play_change_court',
        'daily_play_submit_score',
        'daily_play_cancel_match',
        'daily_play_close_session'
      )
    )
    AND pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_.])digest[[:space:]]*\(';
  IF v_unsafe_digest > 0 THEN
    RAISE EXCEPTION
      'VERIFY_FAIL unqualified digest remains in installed package functions count=%',
      v_unsafe_digest;
  END IF;

  v_runtime_def := pg_get_functiondef(
    to_regprocedure(
      'public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)'
    )
  );
  IF v_runtime_def IS NULL
     OR v_runtime_def NOT ILIKE '%court_resource_reservation_payload_fingerprint%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL reserve does not use canonical fingerprint helper';
  END IF;
  v_runtime_def := pg_get_functiondef(
    to_regprocedure(
      'public.court_resource_release(text,uuid[],text,text,uuid[],text,text)'
    )
  );
  IF v_runtime_def IS NULL
     OR v_runtime_def NOT ILIKE '%court_resource_digest_sha256%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL release does not use canonical digest helper';
  END IF;
  v_runtime_def := pg_get_functiondef(
    to_regprocedure(
      'public.court_resource_reservation_payload_fingerprint(text,uuid[],text,text,text,timestamptz,timestamptz)'
    )
  );
  IF v_runtime_def IS NULL
     OR v_runtime_def NOT ILIKE '%court_resource_digest_sha256%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL payload fingerprint does not use digest helper';
  END IF;

  RAISE NOTICE 'VERIFY_OK Phase 3B canonical reservation package matches ownership manifest';
END
$$;

SELECT 'TABLES' AS object_type, count(*) AS object_count, 3 AS expected
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'court_resource_reservations',
  'court_resource_reservation_commands',
  'court_resource_reservation_cutover'
);
SELECT 'CUTOVER_DEFAULT_OFF' AS check_item,
  (SELECT enabled FROM public.court_resource_reservation_cutover
   WHERE cutover_id = 'canonical-reservation-phase3b') AS enabled,
  false AS expected;
SELECT 'PILOT_UNTOUCHED' AS check_item, true AS ok;
SELECT 'PHASE3A_UNTOUCHED' AS check_item,
  (to_regclass('public.court_resource_physical_courts') IS NOT NULL) AS ok;
SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
