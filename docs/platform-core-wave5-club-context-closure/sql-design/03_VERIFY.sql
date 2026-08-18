-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Post-apply VERIFY — READ-ONLY. Do not mutate.

DO $$
DECLARE
  v_fk_target text;
  v_legacy_venue_fk int;
  v_null_tenant int;
  v_non_canonical int;
  v_club_count int;
  v_marker_fn text;
BEGIN
  SELECT count(*) INTO v_club_count FROM public.clubs;

  SELECT ccu.table_name INTO v_fk_target
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  IF v_fk_target IS DISTINCT FROM 'platform_tenants' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: clubs.tenant_id FK target is %, expected platform_tenants', v_fk_target;
  END IF;

  SELECT count(*) INTO v_legacy_venue_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
    AND ccu.table_name = 'venues';
  IF v_legacy_venue_fk > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: legacy clubs.tenant_id → venues(id) FK still present';
  END IF;

  SELECT count(*) INTO v_null_tenant FROM public.clubs WHERE tenant_id IS NULL;
  IF v_null_tenant > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % clubs have NULL tenant_id', v_null_tenant;
  END IF;

  SELECT count(*) INTO v_non_canonical
  FROM public.clubs c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_tenants pt WHERE pt.id = c.tenant_id
  );
  IF v_non_canonical > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % clubs.tenant_id are not platform_tenants.id', v_non_canonical;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_marker_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'phase42_club_canonical'
  LIMIT 1;
  IF v_marker_fn IS NULL OR v_marker_fn NOT ILIKE '%scope_semantics%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: phase42_club_canonical missing scope_semantics marker';
  END IF;
  IF v_marker_fn NOT ILIKE '%canonical_tenant_id%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: phase42_club_canonical missing canonical_tenant_id';
  END IF;

  IF to_regprocedure('public.platform_is_canonical_tenant_entitled(text)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: platform_is_canonical_tenant_entitled missing';
  END IF;

  RAISE NOTICE 'WAVE5_VERIFY_OK clubs=% fk=platform_tenants', v_club_count;
END $$;

SELECT
  (SELECT count(*) FROM public.clubs) AS clubs_count,
  (SELECT count(*) FROM public.clubs c
    JOIN public.platform_tenants pt ON pt.id = c.tenant_id) AS clubs_canonical_tenant_count;
