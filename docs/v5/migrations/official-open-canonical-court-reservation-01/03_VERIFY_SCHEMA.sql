-- Official/Open canonical court reservation 01: READ-ONLY verify.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_rpc text;
  v_sig text;
BEGIN
  IF to_regclass('public.court_reservations') IS NULL THEN
    v_missing := array_append(v_missing, 'court_reservations');
  END IF;
  IF to_regclass('public.court_reservation_command_ledger') IS NULL THEN
    v_missing := array_append(v_missing, 'court_reservation_command_ledger');
  END IF;
  IF to_regclass('public.daily_play_court_leases') IS NULL THEN
    v_missing := array_append(v_missing, 'daily_play_court_leases');
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.court_assert_available(text,text,text,timestamp with time zone,timestamp with time zone,uuid,boolean,text)',
    'public.official_tournament_reserve_courts(text,text,uuid,jsonb,text,text,text,text,bigint,text)',
    'public.official_tournament_commit_group_schedule(text,text,uuid,text,jsonb,bigint,text)',
    'public.daily_play_assign_court(text,text,uuid,text,text,integer,text)',
    'public.daily_play_change_court(text,text,uuid,text,text,integer,text)',
    'public.daily_play_close_session(text,text,uuid,integer,text)'
  ] LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      v_missing := array_append(v_missing, v_sig);
    END IF;
  END LOOP;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing objects: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='canonical_tournaments' AND column_name='version'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical_tournaments.version missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='court_reservations' AND column_name='origin'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: court_reservations.origin missing';
  END IF;

  IF to_regprocedure('public.canonical_tournament_update(text,text,uuid,jsonb,bigint)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical_tournament_update expected_version overload missing';
  END IF;
  IF pg_get_functiondef('public.canonical_tournament_update(text,text,uuid,jsonb,bigint)'::regprocedure)
       NOT ILIKE '%version = t.version + 1%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical_tournament_update does not increment version';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: btree_gist not installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='court_reservations_no_active_overlap'
      AND conrelid='public.court_reservations'::regclass
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: active reservation exclusion constraint missing';
  END IF;

  FOREACH v_rpc IN ARRAY ARRAY[
    'court_assert_available',
    'official_tournament_reserve_courts',
    'official_tournament_commit_group_schedule',
    'daily_play_assign_court',
    'daily_play_change_court'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=v_rpc AND p.prosecdef
        AND coalesce(array_to_string(p.proconfig,','),'') ILIKE '%search_path=public%'
    ) THEN
      RAISE EXCEPTION 'VERIFY_FAIL: % is not SECURITY DEFINER with search_path=public', v_rpc;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name IN ('court_reservations','court_reservation_command_ledger')
      AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: client DML grant on reservation tables';
  END IF;

  IF has_function_privilege('anon', 'public.official_tournament_reserve_courts(text,text,uuid,jsonb,text,text,text,text,bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon can execute official_tournament_reserve_courts';
  END IF;
  IF has_function_privilege('anon', 'public.official_tournament_commit_group_schedule(text,text,uuid,text,jsonb,bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon can execute official_tournament_commit_group_schedule';
  END IF;
  IF has_function_privilege('authenticated', 'public.court_assert_available(text,text,text,timestamp with time zone,timestamp with time zone,uuid,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated can execute internal court_assert_available';
  END IF;

  IF pg_get_functiondef('public.daily_play_assign_court(text,text,uuid,text,text,integer,text)'::regprocedure)
       NOT ILIKE '%court_assert_available%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: daily_play_assign_court does not consult court_assert_available';
  END IF;
  IF pg_get_functiondef('public.official_tournament_reserve_courts(text,text,uuid,jsonb,text,text,text,text,bigint,text)'::regprocedure)
       NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: reserve RPC missing FOR UPDATE';
  END IF;
  IF pg_get_functiondef('public.official_tournament_inventory_courts(text)'::regprocedure)
       ILIKE '%venue_id%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: inventory helper must not filter venue_id (Phase 2N)';
  END IF;

  RAISE NOTICE 'VERIFY_OK: official-open-canonical-court-reservation-01';
END
$$;
