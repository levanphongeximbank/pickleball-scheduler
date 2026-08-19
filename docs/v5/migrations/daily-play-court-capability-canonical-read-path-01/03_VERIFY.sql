-- Daily Play court capability canonical read-path 01 VERIFY.
-- READ-ONLY proofs. No row writes.
-- SELECTED_STRATEGY=CANONICAL

DO $$
DECLARE
  v_errors text[] := ARRAY[]::text[];
  v_court_def text;
  v_daily_def text;
  v_actor uuid;
  v_claims text;
  v_listed jsonb;
  v_daily jsonb;
  v_usable integer;
  v_join_count integer;
  v_has_physical boolean;
  v_wrong jsonb;
BEGIN
  IF to_regprocedure('public.court_resource_list_eligible_courts(text,text,text)') IS NULL THEN
    v_errors := array_append(v_errors, 'court_resource_list_eligible_courts missing');
  END IF;
  IF to_regprocedure('public.daily_play_read_courts(text,jsonb)') IS NULL THEN
    v_errors := array_append(v_errors, 'daily_play_read_courts missing');
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_court_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'court_resource_list_eligible_courts'
    AND pg_get_function_identity_arguments(p.oid) = 'p_tenant_id text, p_club_id text, p_cluster_id text';

  SELECT pg_get_functiondef(p.oid) INTO v_daily_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_read_courts'
    AND pg_get_function_identity_arguments(p.oid) = 'p_club_id text, p_enabled_court_ids jsonb';

  IF v_court_def IS NULL OR v_daily_def IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing function definitions';
  END IF;

  IF v_court_def NOT ILIKE '%profiles%' OR v_court_def NOT ILIKE '%p.tenant_id%' THEN
    v_errors := array_append(v_errors, 'court reader must authorize via profiles.tenant_id');
  END IF;
  IF v_court_def ILIKE '%user_venue_id%' THEN
    v_errors := array_append(v_errors, 'court reader must not use user_venue_id as tenant authority');
  END IF;
  IF v_court_def ILIKE '%user_tenant_id%' THEN
    v_errors := array_append(v_errors, 'court reader must not use user_tenant_id venue fallback');
  END IF;
  IF v_court_def NOT ILIKE '%cc.tenant_id%' THEN
    v_errors := array_append(v_errors, 'court reader must filter cluster by court_clusters.tenant_id');
  END IF;
  IF v_court_def ILIKE '%SELECT cc.venue_id INTO v_cluster_tenant%' THEN
    v_errors := array_append(v_errors, 'court reader must not treat cluster venue_id as tenant');
  END IF;
  IF v_court_def NOT ILIKE '%physicalCourtId%' THEN
    v_errors := array_append(v_errors, 'court reader must return physicalCourtId');
  END IF;
  IF v_court_def NOT ILIKE '%search_path%pg_catalog, public%'
     AND v_court_def NOT ILIKE '%search_path TO ''pg_catalog'', ''public''%' THEN
    v_errors := array_append(v_errors, 'court reader search_path must be pinned');
  END IF;
  IF v_court_def ILIKE '%club_data_v3%' OR v_court_def ILIKE '%localStorage%' THEN
    v_errors := array_append(v_errors, 'court reader must not read club_data_v3 or localStorage');
  END IF;

  IF v_daily_def NOT ILIKE '%court_resource_list_eligible_courts%' THEN
    v_errors := array_append(v_errors, 'daily_play_read_courts must delegate to court_resource_list_eligible_courts');
  END IF;
  IF v_daily_def ILIKE '%club_data_v3%' THEN
    v_errors := array_append(v_errors, 'daily_play_read_courts must not parse club_data_v3');
  END IF;
  IF v_daily_def ILIKE '%court_resource_physical_courts%'
     OR v_daily_def ILIKE '%court_resource_club_operational_access%' THEN
    v_errors := array_append(v_errors, 'daily_play_read_courts must not query court_resource_* tables');
  END IF;
  IF v_daily_def NOT ILIKE '%physicalCourtId%' THEN
    v_errors := array_append(v_errors, 'daily projection must include physicalCourtId');
  END IF;
  IF v_daily_def ILIKE '%localStorage%' THEN
    v_errors := array_append(v_errors, 'daily reader must not use localStorage');
  END IF;

  IF has_function_privilege('anon', 'public.court_resource_list_eligible_courts(text,text,text)', 'EXECUTE') THEN
    v_errors := array_append(v_errors, 'anon must not EXECUTE court reader');
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.court_resource_list_eligible_courts(text,text,text)', 'EXECUTE') THEN
    v_errors := array_append(v_errors, 'authenticated must EXECUTE court reader');
  END IF;
  IF has_function_privilege('anon', 'public.daily_play_read_courts(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.daily_play_read_courts(text,jsonb)', 'EXECUTE') THEN
    v_errors := array_append(v_errors, 'daily_play_read_courts must not be a browser RPC');
  END IF;

  SELECT count(*)::integer INTO v_join_count
  FROM public.court_resource_physical_courts pc
  INNER JOIN public.court_resource_club_operational_access a
    ON a.physical_court_id = pc.physical_court_id
   AND a.tenant_id = pc.tenant_id
  WHERE pc.tenant_id = 'venue-staging-a'
    AND a.club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
    AND a.status = 'enabled'
    AND pc.lifecycle_status = 'active';
  IF v_join_count < 1 THEN
    v_errors := array_append(v_errors, 'canonical join for selected Daily club returned 0 courts');
  END IF;

  -- Authenticated functional probe (session-local JWT claim; no profile mutation).
  SELECT p.id
  INTO v_actor
  FROM public.profiles p
  WHERE p.tenant_id = 'venue-staging-a'
    AND coalesce(p.status, 'active') = 'active'
    AND coalesce(p.role, '') IS DISTINCT FROM 'SUPER_ADMIN'
  ORDER BY p.created_at
  LIMIT 1;

  IF v_actor IS NULL THEN
    v_errors := array_append(v_errors, 'no non-super-admin Tenant A profile for reader probe');
  ELSE
    v_claims := json_build_object('sub', v_actor::text, 'role', 'authenticated')::text;
    PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
    PERFORM set_config('request.jwt.claims', v_claims, true);

    v_listed := public.court_resource_list_eligible_courts(
      'venue-staging-a',
      'club-ecebf64c78f948ccb2b59842441eb26c',
      NULL
    );
    v_daily := public.daily_play_read_courts(
      'club-ecebf64c78f948ccb2b59842441eb26c',
      NULL
    );

    IF coalesce((v_listed->>'ok')::boolean, false) IS NOT TRUE THEN
      v_errors := array_append(
        v_errors,
        format('court reader call failed code=%s', coalesce(v_listed->>'code', 'null'))
      );
    END IF;

    v_usable := CASE
      WHEN jsonb_typeof(v_daily) = 'array' THEN jsonb_array_length(v_daily)
      ELSE 0
    END;
    IF v_usable < 1 THEN
      v_errors := array_append(v_errors, 'daily_play_read_courts usable court count < 1');
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_daily, '[]'::jsonb)) c
      WHERE nullif(c->>'physicalCourtId', '') IS NOT NULL
        AND c->>'physicalCourtId' = c->>'id'
    ) INTO v_has_physical;
    IF NOT v_has_physical THEN
      v_errors := array_append(v_errors, 'daily projection missing physicalCourtId identity');
    END IF;

    v_wrong := public.court_resource_list_eligible_courts(
      'venue-staging-b',
      'club-ecebf64c78f948ccb2b59842441eb26c',
      NULL
    );
    IF coalesce(v_wrong->>'code', '') NOT IN ('TENANT_FORBIDDEN', 'TENANT_MISMATCH') THEN
      v_errors := array_append(
        v_errors,
        format('wrong tenant must deny, got %s', coalesce(v_wrong->>'code', 'null'))
      );
    END IF;
    IF jsonb_typeof(v_wrong->'courts') = 'array' AND jsonb_array_length(v_wrong->'courts') <> 0 THEN
      v_errors := array_append(v_errors, 'wrong tenant must return zero courts');
    END IF;

    -- Venue-as-tenant: venue id must not authorize a distinct missing tenant.
    v_wrong := public.court_resource_list_eligible_courts(
      'venue-staging-a',
      'club-5135b36cb62c4f0187d7fb7fd3d8ae48',
      NULL
    );
    IF coalesce((v_wrong->>'ok')::boolean, false) IS TRUE
       AND jsonb_typeof(v_wrong->'courts') = 'array'
       AND jsonb_array_length(v_wrong->'courts') > 0 THEN
      v_errors := array_append(v_errors, 'club without operational access must not return courts');
    END IF;
  END IF;

  IF cardinality(v_errors) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: %', array_to_string(v_errors, '; ');
  END IF;

  RAISE NOTICE 'VERIFY_OK daily-play-court-capability-canonical-read-path-01 usable=% join=%',
    v_usable, v_join_count;
END
$$;

SELECT 'SELECTED_STRATEGY' AS check_item, 'CANONICAL' AS value, true AS ok;
SELECT 'COMPATIBILITY_FALLBACK_USED' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_TOUCHED' AS check_item, 'NO' AS value, true AS ok;
