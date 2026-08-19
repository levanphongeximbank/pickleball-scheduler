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
  v_table text;
  v_legacy_venue_fk int;
  v_null_tenant int;
  v_non_canonical int;
  v_mismatch int;
  v_club_count int;
  v_member_count int;
  v_gov_count int;
  v_req_count int;
  v_marker_fn text;
  v_create_fn text;
  v_list_fn text;
  v_update_fn text;
  v_assign_fn text;
  v_members_fn text;
  v_helper_fn text;
  v_delete_rule text;
  v_phase42_global text;
BEGIN
  SELECT count(*) INTO v_club_count FROM public.clubs;
  SELECT count(*) INTO v_member_count FROM public.club_members;
  SELECT count(*) INTO v_gov_count FROM public.club_governance_assignments;
  SELECT count(*) INTO v_req_count FROM public.club_membership_requests_v42;

  FOREACH v_table IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    SELECT ccu.table_name, rc.delete_rule
      INTO v_fk_target, v_delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = v_table
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'tenant_id'
    LIMIT 1;

    IF v_fk_target IS DISTINCT FROM 'platform_tenants' THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: %.tenant_id FK target is %, expected platform_tenants',
        v_table, coalesce(v_fk_target, '<null>');
    END IF;
    IF v_delete_rule IS DISTINCT FROM 'RESTRICT' THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: %.tenant_id delete rule is %, expected RESTRICT',
        v_table, coalesce(v_delete_rule, '<null>');
    END IF;
  END LOOP;

  SELECT count(*) INTO v_legacy_venue_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name IN (
      'clubs', 'club_members', 'club_governance_assignments', 'club_membership_requests_v42'
    )
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
    AND ccu.table_name = 'venues';
  IF v_legacy_venue_fk > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: legacy Club tenant_id → venues(id) FK still present';
  END IF;

  SELECT count(*) INTO v_null_tenant FROM public.clubs WHERE tenant_id IS NULL;
  IF v_null_tenant > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % clubs have NULL tenant_id', v_null_tenant;
  END IF;

  SELECT count(*) INTO v_non_canonical
  FROM public.clubs c
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = c.tenant_id);
  IF v_non_canonical > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % clubs.tenant_id are not platform_tenants.id', v_non_canonical;
  END IF;

  SELECT count(*) INTO v_non_canonical
  FROM public.club_members cm
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = cm.tenant_id);
  IF v_non_canonical > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % club_members.tenant_id are not platform_tenants.id', v_non_canonical;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM public.club_members cm
  JOIN public.clubs c ON c.id = cm.club_id
  WHERE cm.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % club_members.tenant_id disagree with Club', v_mismatch;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM public.club_governance_assignments g
  JOIN public.clubs c ON c.id = g.club_id
  WHERE g.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % governance tenant_id disagree with Club', v_mismatch;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM public.club_membership_requests_v42 r
  JOIN public.clubs c ON c.id = r.club_id
  WHERE r.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % request tenant_id disagree with Club', v_mismatch;
  END IF;

  SELECT ccu.table_name INTO v_fk_target
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'tenant_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;
  IF v_fk_target IS DISTINCT FROM 'platform_tenants' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: tenant_members.tenant_id FK is %, expected platform_tenants',
      coalesce(v_fk_target, '<null>');
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

  SELECT pg_get_functiondef(p.oid) INTO v_create_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_create'
  LIMIT 1;
  IF v_create_fn IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_create missing';
  END IF;
  IF v_create_fn ~* 'from[[:space:]]+public\.venues[[:space:]]+v[[:space:]]+where[[:space:]]+v\.id[[:space:]]*=' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_create still validates tenant via venues.id';
  END IF;
  IF v_create_fn NOT ILIKE '%platform_tenants%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_create does not check platform_tenants';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_list_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_list_registry'
  LIMIT 1;
  IF v_list_fn IS NULL OR v_list_fn NOT ILIKE '%platform_is_canonical_tenant_entitled%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_list_registry missing canonical entitlement';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_members_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_list_members'
  LIMIT 1;
  IF v_members_fn IS NOT NULL AND v_members_fn ILIKE '%phase42_is_tenant_member%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_list_members still uses phase42_is_tenant_member';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_update_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'phase42_can_update_club'
  LIMIT 1;
  IF v_update_fn IS NOT NULL AND v_update_fn ~* 'p\.venue_id[[:space:]]*=[[:space:]]*c\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: phase42_can_update_club still uses Venue ID == Tenant ID';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_assign_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'phase42_can_assign_club_owner'
  LIMIT 1;
  IF v_assign_fn IS NOT NULL AND v_assign_fn ~* 'p\.venue_id[[:space:]]*=[[:space:]]*c\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: phase42_can_assign_club_owner still uses Venue ID == Tenant ID';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_helper_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_add_member'
  LIMIT 1;
  IF v_helper_fn IS NOT NULL
     AND v_helper_fn ILIKE '%phase42n_ensure_athlete_for_user%'
     AND v_helper_fn ILIKE '%v_club.tenant_id%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_add_member still passes Club tenant_id to athlete helper';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_phase42_global
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'phase42_is_tenant_member'
  LIMIT 1;
  IF v_phase42_global IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: phase42_is_tenant_member missing — Wave 5 must not globally retire it';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'venue_id'
  ) THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: clubs.venue_id invented without authorization';
  END IF;

  RAISE NOTICE 'WAVE5_VERIFY_OK clubs=% members=% gov=% req=% fk=platform_tenants',
    v_club_count, v_member_count, v_gov_count, v_req_count;
END $$;

SELECT
  (SELECT count(*) FROM public.clubs) AS clubs_count,
  (SELECT count(*) FROM public.club_members) AS club_members_count,
  (SELECT count(*) FROM public.club_governance_assignments) AS club_governance_assignments_count,
  (SELECT count(*) FROM public.club_membership_requests_v42) AS club_membership_requests_v42_count,
  (SELECT count(*) FROM public.clubs c
    JOIN public.platform_tenants pt ON pt.id = c.tenant_id) AS clubs_canonical_tenant_count;
