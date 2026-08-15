-- Venue/Court canonical cluster membership binding — post-apply verification.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Read-only. This implementation run did not apply Staging or Production.

DO $$
DECLARE
  v_def text;
  v_count int;
BEGIN
  IF to_regprocedure(
    'public.bind_club_courts_to_cluster(uuid, text, text, text, text[], integer, integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing bind_club_courts_to_cluster signature';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'bind_club_courts_to_cluster';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unexpected bind_club_courts_to_cluster overload count=%', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'bind_club_courts_to_cluster'
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') ILIKE '%search_path=public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: bind_club_courts_to_cluster is not SECURITY DEFINER search_path=public';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.bind_club_courts_to_cluster(uuid, text, text, text, text[], integer, integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated EXECUTE missing on bind_club_courts_to_cluster';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.bind_club_courts_to_cluster(uuid, text, text, text, text[], integer, integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon can execute bind_club_courts_to_cluster';
  END IF;

  v_def := pg_get_functiondef(
    'public.bind_club_courts_to_cluster(uuid, text, text, text, text[], integer, integer)'::regprocedure
  );

  IF v_def NOT ILIKE '%auth.uid() IS NULL%' AND v_def NOT ILIKE '%auth.uid() is null%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: auth required check missing';
  END IF;
  IF v_def NOT ILIKE '%phase42_can_update_club%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: tenant/club authorization helper missing';
  END IF;
  IF v_def NOT ILIKE '%CLUB_TENANT_MISMATCH%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: tenant isolation missing';
  END IF;
  IF v_def NOT ILIKE '%CROSS_CLUB_COURT%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: cross-club write denial missing';
  END IF;
  IF v_def NOT ILIKE '%CLUSTER_VENUE_MISMATCH%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: cross-venue cluster denial missing';
  END IF;
  IF v_def NOT ILIKE '%CLUSTER_INACTIVE%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: inactive cluster denial missing';
  END IF;
  IF v_def NOT ILIKE '%CLUSTER_NOT_FOUND%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing cluster denial missing';
  END IF;
  IF v_def NOT ILIKE '%COURT_NOT_FOUND%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unknown court denial missing';
  END IF;
  IF v_def NOT ILIKE '%FOREIGN_CLUSTER%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: foreign existing cluster fail-closed missing';
  END IF;
  IF v_def NOT ILIKE '%AMBIGUOUS_CLUB_BLOB%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: ambiguous blob fail-closed missing';
  END IF;
  IF v_def NOT ILIKE '%NOT_AUTHENTICATED%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anonymous execute denial missing';
  END IF;
  IF v_def NOT ILIKE '%jsonb_set(v_payload, ''{data,courts}''%'
     AND v_def NOT ILIKE '%jsonb_set(v_payload, ''{courts}''%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: selected-court JSON patch missing';
  END IF;
  IF v_def NOT ILIKE '%registered_cluster_id = v_cluster_id%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: club registered_cluster_id update missing';
  END IF;
  IF v_def ILIKE '%tournament%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: tournament-specific knowledge leaked into shared binder';
  END IF;
  IF v_def ILIKE '%DELETE FROM public.club_data_v3%'
     OR v_def ILIKE '%INSERT INTO public.club_data_v3%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: binder must not create/delete club_data_v3 rows';
  END IF;
END
$$;
