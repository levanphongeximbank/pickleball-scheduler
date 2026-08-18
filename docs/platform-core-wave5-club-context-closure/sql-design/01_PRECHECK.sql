-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Wave 5 Club Tenant migration PRECHECK — READ-ONLY, fail closed.
-- Do not repair unexpected data. Do not mutate.

DO $$
DECLARE
  v_clubs_exists boolean;
  v_clubs_tenant_col boolean;
  v_platform_tenants_exists boolean;
  v_venues_exists boolean;
  v_venues_tenant_col boolean;
  v_fk_target text;
  v_orphan_club_scope int;
  v_venue_missing_tenant int;
  v_tenant_unresolved int;
  v_ambiguous int;
  v_club_count int;
  v_mapped_count int;
BEGIN
  v_clubs_exists := to_regclass('public.clubs') IS NOT NULL;
  v_platform_tenants_exists := to_regclass('public.platform_tenants') IS NOT NULL;
  v_venues_exists := to_regclass('public.venues') IS NOT NULL;

  IF NOT v_clubs_exists THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.clubs missing';
  END IF;
  IF NOT v_platform_tenants_exists THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.platform_tenants missing';
  END IF;
  IF NOT v_venues_exists THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.venues missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'tenant_id'
  ) INTO v_clubs_tenant_col;
  IF NOT v_clubs_tenant_col THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: clubs.tenant_id missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'tenant_id'
  ) INTO v_venues_tenant_col;
  IF NOT v_venues_tenant_col THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: venues.tenant_id missing';
  END IF;

  SELECT ccu.table_name
    INTO v_fk_target
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
  ORDER BY tc.constraint_name
  LIMIT 1;

  IF v_fk_target IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: clubs.tenant_id has no FK (unexpected)';
  END IF;

  IF v_fk_target = 'platform_tenants' THEN
    RAISE NOTICE 'WAVE5_PRECHECK_INFO: clubs.tenant_id already references platform_tenants — treat as already canonical; do not re-translate';
  ELSIF v_fk_target <> 'venues' THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: clubs.tenant_id FK target is %, expected venues (legacy) or platform_tenants (already canonical)', v_fk_target;
  END IF;

  SELECT count(*) INTO v_club_count FROM public.clubs;

  IF v_fk_target = 'venues' THEN
    SELECT count(*) INTO v_orphan_club_scope
    FROM public.clubs c
    WHERE c.tenant_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = c.tenant_id);
    IF v_orphan_club_scope > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club tenant_id values do not resolve to venues.id', v_orphan_club_scope;
    END IF;

    SELECT count(*) INTO v_venue_missing_tenant
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    WHERE v.tenant_id IS NULL OR btrim(v.tenant_id) = '';
    IF v_venue_missing_tenant > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % clubs map to venues with null tenant_id', v_venue_missing_tenant;
    END IF;

    SELECT count(*) INTO v_tenant_unresolved
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.platform_tenants pt WHERE pt.id = v.tenant_id
    );
    IF v_tenant_unresolved > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % clubs map to venues.tenant_id not in platform_tenants', v_tenant_unresolved;
    END IF;

    -- Ambiguous mapping: one club legacy scope resolving to >1 canonical tenant (should be 1:1 via venues.id PK)
    SELECT count(*) INTO v_ambiguous
    FROM (
      SELECT c.id
      FROM public.clubs c
      JOIN public.venues v ON v.id = c.tenant_id
      GROUP BY c.id
      HAVING count(DISTINCT v.tenant_id) > 1
    ) amb;
    IF v_ambiguous > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % clubs have non-deterministic canonical Tenant mapping', v_ambiguous;
    END IF;

    SELECT count(*) INTO v_mapped_count
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    JOIN public.platform_tenants pt ON pt.id = v.tenant_id;
    IF v_mapped_count <> v_club_count THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: mapped count % <> club count %', v_mapped_count, v_club_count;
    END IF;
  END IF;

  RAISE NOTICE 'WAVE5_PRECHECK_OK clubs=% fk_target=% mapped=%', v_club_count, v_fk_target, v_mapped_count;
END $$;

SELECT
  (SELECT count(*) FROM public.clubs) AS clubs_count,
  (SELECT count(*) FROM public.venues) AS venues_count,
  (SELECT count(*) FROM public.platform_tenants) AS platform_tenants_count;
