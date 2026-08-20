-- Daily Play court capability canonical read-path 01 PRECHECK.
-- READ-ONLY. Fail closed. No mutations.
-- SELECTED_STRATEGY=CANONICAL
-- Target: Staging qyewbxjsiiyufanzcjcq only. Production forbidden.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_errors text[] := ARRAY[]::text[];
  v_overloads integer;
  v_physical_a integer;
  v_access_club integer;
  v_distinct_physical integer;
  v_tenant_col boolean;
  v_venue_col boolean;
BEGIN
  IF current_database() ILIKE '%prod%' OR current_database() ILIKE '%expuvcohlcjzvrrauvud%' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL PRODUCTION_FORBIDDEN';
  END IF;

  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;
  IF to_regclass('public.court_resource_club_operational_access') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_club_operational_access');
  END IF;
  IF to_regclass('public.court_clusters') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_clusters');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.profiles');
  END IF;

  IF to_regprocedure('public.court_resource_list_eligible_courts(text,text,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_list_eligible_courts(text,text,text)');
  END IF;
  IF to_regprocedure('public.daily_play_read_courts(text,jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.daily_play_read_courts(text,jsonb)');
  END IF;
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.is_super_admin()');
  END IF;
  IF to_regprocedure('public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text)') IS NULL THEN
    v_missing := array_append(
      v_missing,
      'public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text)'
    );
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing objects: %', array_to_string(v_missing, ', ');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'court_clusters'
      AND column_name = 'tenant_id' AND data_type = 'text'
  ) INTO v_tenant_col;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'court_clusters'
      AND column_name = 'venue_id' AND data_type = 'text'
  ) INTO v_venue_col;
  IF NOT v_tenant_col OR NOT v_venue_col THEN
    RAISE EXCEPTION 'PRECHECK_FAIL court_clusters tenant_id/venue_id columns required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs'
      AND column_name = 'tenant_id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL clubs.tenant_id required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'tenant_id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PRECHECK_FAIL profiles.tenant_id required';
  END IF;

  SELECT count(*) INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'court_resource_list_eligible_courts';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL court_resource_list_eligible_courts overload count=%', v_overloads;
  END IF;

  SELECT count(*) INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_read_courts';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL daily_play_read_courts overload count=%', v_overloads;
  END IF;

  -- Strategy A assumption: canonical inventory already ready for Tenant A Daily club.
  SELECT count(*)::integer INTO v_physical_a
  FROM public.court_resource_physical_courts
  WHERE tenant_id = 'venue-staging-a'
    AND lifecycle_status = 'active';
  IF v_physical_a < 1 THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL CANONICAL_INVENTORY_DATA_GAP active physical courts for venue-staging-a=%',
      v_physical_a;
  END IF;

  SELECT count(*)::integer, count(DISTINCT physical_court_id)::integer
  INTO v_access_club, v_distinct_physical
  FROM public.court_resource_club_operational_access
  WHERE tenant_id = 'venue-staging-a'
    AND club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
    AND status = 'enabled';
  IF v_access_club < 1 OR v_distinct_physical < 1 THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL CANONICAL_INVENTORY_DATA_GAP enabled club access count=% distinct=%',
      v_access_club, v_distinct_physical;
  END IF;

  -- Grants: Daily helper is not a browser RPC; Court reader is authenticated-only.
  IF has_function_privilege('anon', 'public.court_resource_list_eligible_courts(text,text,text)', 'EXECUTE') THEN
    v_errors := array_append(v_errors, 'anon must not EXECUTE court_resource_list_eligible_courts');
  END IF;
  IF has_function_privilege('anon', 'public.daily_play_read_courts(text,jsonb)', 'EXECUTE') THEN
    v_errors := array_append(v_errors, 'anon must not EXECUTE daily_play_read_courts');
  END IF;
  IF has_function_privilege('authenticated', 'public.daily_play_read_courts(text,jsonb)', 'EXECUTE') THEN
    v_errors := array_append(v_errors, 'authenticated must not EXECUTE daily_play_read_courts');
  END IF;

  IF cardinality(v_errors) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: %', array_to_string(v_errors, '; ');
  END IF;

  RAISE NOTICE 'PRECHECK_OK daily-play-court-capability-canonical-read-path-01 strategy=CANONICAL physical_a=% access_club=%',
    v_physical_a, v_access_club;
END
$$;

SELECT 'STAGING_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'SELECTED_STRATEGY' AS check_item, 'CANONICAL' AS value, true AS ok;
SELECT 'PRODUCTION_FORBIDDEN' AS check_item, 'YES' AS value, true AS ok;
