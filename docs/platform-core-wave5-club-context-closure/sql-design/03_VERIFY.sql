-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Post-apply VERIFY — READ-ONLY. Do not mutate.
-- Post-state invariants only. Cannot prove a historical LOCK TABLE occurred.
-- Default: mutation RPCs still quiesced. After 07D: SET wave5.verify_privileges = 'YES'
-- MUTATION_RPC_POST_PRIVILEGES_VERIFIED is that second pass.
-- POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14

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
  v_dup_name int;
  v_dup_code int;
  v_prosecdef boolean;
  v_proconfig text[];
  v_cluster_orphan int;
  v_cluster_xtenant int;
  v_cmd text;
  v_cmd_ok int := 0;
  v_oid regprocedure;
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

  SELECT pg_get_functiondef('public.club_add_member(uuid,text,uuid,text,integer)'::regprocedure)
    INTO v_helper_fn;
  IF v_helper_fn IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_add_member(uuid,text,uuid,text,integer) missing';
  END IF;
  IF position('wave5_ensure_athlete_for_club_member' in v_helper_fn) = 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_add_member missing explicit wave5 athlete helper';
  END IF;
  IF v_helper_fn ~ 'phase42n_ensure_athlete_for_user[[:space:]]*\([^)]*v_club\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_add_member still passes Club tenant_id to athlete helper';
  END IF;
  SELECT p.prosecdef, p.proconfig INTO v_prosecdef, v_proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.oid = 'public.club_add_member(uuid,text,uuid,text,integer)'::regprocedure;
  IF v_prosecdef IS NOT TRUE THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_add_member is not SECURITY DEFINER';
  END IF;
  IF coalesce(array_to_string(v_proconfig, ','), '') NOT ILIKE '%search_path=public%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_add_member search_path not public';
  END IF;
  IF current_setting('wave5.verify_privileges', true) = 'YES' THEN
    IF NOT has_function_privilege(
      'authenticated',
      'public.club_add_member(uuid,text,uuid,text,integer)',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: authenticated GRANT EXECUTE missing on club_add_member';
    END IF;
  ELSIF has_function_privilege(
      'authenticated',
      'public.club_add_member(uuid,text,uuid,text,integer)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_add_member still executable while quiesced — restore is 07D after VERIFY bodies';
  END IF;

  IF to_regprocedure('public.club_restore_member(uuid,text,uuid,integer)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_restore_member(uuid,text,uuid,integer) missing';
  END IF;
  SELECT pg_get_functiondef('public.club_restore_member(uuid,text,uuid,integer)'::regprocedure)
    INTO v_helper_fn;
  IF position('wave5_ensure_athlete_for_club_member' in v_helper_fn) = 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_restore_member missing explicit wave5 athlete helper';
  END IF;
  IF v_helper_fn ~ 'phase42n_ensure_athlete_for_user[[:space:]]*\([^)]*v_club\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_restore_member still passes Club tenant_id to athlete helper';
  END IF;
  IF current_setting('wave5.verify_privileges', true) = 'YES' THEN
    IF NOT has_function_privilege(
      'authenticated',
      'public.club_restore_member(uuid,text,uuid,integer)',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: authenticated GRANT EXECUTE missing on club_restore_member';
    END IF;
  ELSIF has_function_privilege(
      'authenticated',
      'public.club_restore_member(uuid,text,uuid,integer)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_restore_member still executable while quiesced — restore is 07D after VERIFY bodies';
  END IF;

  IF to_regprocedure('public.club_review_membership_request(uuid,uuid,text,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_review_membership_request(uuid,uuid,text,text,integer) missing';
  END IF;
  SELECT pg_get_functiondef('public.club_review_membership_request(uuid,uuid,text,text,integer)'::regprocedure)
    INTO v_helper_fn;
  IF position('wave5_ensure_athlete_for_club_member' in v_helper_fn) = 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_review_membership_request missing explicit wave5 athlete helper';
  END IF;
  IF v_helper_fn ~ 'phase42n_ensure_athlete_for_user[[:space:]]*\([^)]*v_row\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_review_membership_request still passes Club tenant_id to athlete helper';
  END IF;
  IF current_setting('wave5.verify_privileges', true) = 'YES' THEN
    IF NOT has_function_privilege(
      'authenticated',
      'public.club_review_membership_request(uuid,uuid,text,text,integer)',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: authenticated GRANT EXECUTE missing on club_review_membership_request';
    END IF;
  ELSIF has_function_privilege(
      'authenticated',
      'public.club_review_membership_request(uuid,uuid,text,text,integer)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: club_review_membership_request still executable while quiesced — restore is 07D after VERIFY bodies';
  END IF;

  SELECT pg_get_functiondef('public.wave5_ensure_athlete_for_club_member(uuid,text,text)'::regprocedure)
    INTO v_helper_fn;
  IF position('ATHLETE_FACILITY_VENUE_REQUIRED' in v_helper_fn) = 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: wave5_ensure_athlete_for_club_member missing no-cluster fail-closed';
  END IF;
  IF v_helper_fn ~ 'p_tenant_id' OR v_helper_fn ILIKE '%v_club.tenant_id%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: wave5 athlete helper must not take Club Tenant as Venue';
  END IF;
  SELECT p.prosecdef, p.proconfig INTO v_prosecdef, v_proconfig
  FROM pg_proc p
  WHERE p.oid = 'public.wave5_ensure_athlete_for_club_member(uuid,text,text)'::regprocedure;
  IF v_prosecdef IS NOT TRUE THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: wave5_ensure_athlete_for_club_member is not SECURITY DEFINER';
  END IF;
  IF coalesce(array_to_string(v_proconfig, ','), '') NOT ILIKE '%search_path=public%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: wave5_ensure_athlete_for_club_member search_path not public';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.wave5_ensure_athlete_for_club_member(uuid,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: authenticated EXECUTE must be DENIED on wave5_ensure_athlete_for_club_member';
  END IF;

  SELECT pg_get_functiondef('public.wave5_resolve_club_facility_venue_id(text)'::regprocedure)
    INTO v_helper_fn;
  IF v_helper_fn !~ 'v\.tenant_id[[:space:]]*=[[:space:]]*c\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: facility resolver missing canonical Tenant binding v.tenant_id = c.tenant_id';
  END IF;
  IF v_helper_fn ~ 'cc\.venue_id[[:space:]]*=[[:space:]]*c\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: facility resolver must not treat cluster Venue as Club Tenant coincidence';
  END IF;
  IF position('REGISTERED_CLUSTER_TENANT_MISMATCH' in v_helper_fn) = 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: facility resolver missing REGISTERED_CLUSTER_TENANT_MISMATCH diagnostic';
  END IF;
  SELECT p.prosecdef, p.proconfig INTO v_prosecdef, v_proconfig
  FROM pg_proc p
  WHERE p.oid = 'public.wave5_resolve_club_facility_venue_id(text)'::regprocedure;
  IF v_prosecdef IS NOT TRUE THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: wave5_resolve_club_facility_venue_id is not SECURITY DEFINER';
  END IF;
  IF coalesce(array_to_string(v_proconfig, ','), '') NOT ILIKE '%search_path=public%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: wave5_resolve_club_facility_venue_id search_path not public';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.wave5_resolve_club_facility_venue_id(text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: authenticated EXECUTE must be DENIED on wave5_resolve_club_facility_venue_id';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    IF NOT has_function_privilege(
      'service_role',
      'public.wave5_ensure_athlete_for_club_member(uuid,text,text)',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: service_role EXECUTE missing on wave5_ensure_athlete_for_club_member';
    END IF;
  END IF;

  SELECT count(*) INTO v_cluster_orphan
  FROM public.clubs c
  WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.court_clusters cc
      JOIN public.venues v ON v.id = cc.venue_id
      WHERE cc.id = c.registered_cluster_id
        AND nullif(trim(cc.venue_id), '') IS NOT NULL
    );
  IF v_cluster_orphan > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: REGISTERED_CLUSTER_ORPHAN_COUNT=%', v_cluster_orphan;
  END IF;
  SELECT count(*) INTO v_cluster_xtenant
  FROM public.clubs c
  JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
  JOIN public.venues v ON v.id = cc.venue_id
  WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
    AND v.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_cluster_xtenant > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: REGISTERED_CLUSTER_CROSS_TENANT_COUNT=%', v_cluster_xtenant;
  END IF;

  SELECT count(*) INTO v_dup_name FROM (
    SELECT c.tenant_id, lower(c.name)
    FROM public.clubs c
    WHERE c.deleted_at IS NULL
    GROUP BY c.tenant_id, lower(c.name)
    HAVING count(*) > 1
  ) d;
  IF v_dup_name > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: POST_MAP_DUPLICATE_CLUB_NAME_COUNT=%', v_dup_name;
  END IF;
  SELECT count(*) INTO v_dup_code FROM (
    SELECT c.tenant_id, c.code
    FROM public.clubs c
    WHERE c.deleted_at IS NULL AND c.code IS NOT NULL
    GROUP BY c.tenant_id, c.code
    HAVING count(*) > 1
  ) d;
  IF v_dup_code > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: POST_MAP_DUPLICATE_CLUB_CODE_COUNT=%', v_dup_code;
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

  -- POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14
  FOREACH v_cmd IN ARRAY ARRAY[
    'public.club_create(uuid,text,text,text,text,text)',
    'public.club_update(uuid,text,integer,text,text,text,text,text)',
    'public.club_assign_owner(uuid,text,uuid,integer)',
    'public.club_clear_owner(uuid,text,integer)',
    'public.club_transfer_president(uuid,text,uuid,integer)',
    'public.club_assign_vice_president(uuid,text,uuid,integer)',
    'public.club_clear_vice_president(uuid,text,integer,uuid)',
    'public.club_add_member(uuid,text,uuid,text,integer)',
    'public.club_remove_member(uuid,text,uuid,integer)',
    'public.club_restore_member(uuid,text,uuid,integer)',
    'public.club_leave_membership(uuid,text)',
    'public.club_submit_membership_request(uuid,text,text)',
    'public.club_cancel_membership_request(uuid,uuid,integer)',
    'public.club_review_membership_request(uuid,uuid,text,text,integer)'
  ]
  LOOP
    IF to_regprocedure(v_cmd) IS NULL THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: canonical command missing %', v_cmd;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE p.oid = v_cmd::regprocedure
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee = 0
    ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: PUBLIC EXECUTE must be DENIED on %', v_cmd;
    END IF;
    IF has_function_privilege('anon', v_cmd, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: anon EXECUTE must be DENIED on %', v_cmd;
    END IF;
    IF current_setting('wave5.verify_privileges', true) = 'YES' THEN
      IF NOT has_function_privilege('authenticated', v_cmd, 'EXECUTE') THEN
        RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: authenticated GRANT EXECUTE missing on %', v_cmd;
      END IF;
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc p
        CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
        JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
        WHERE p.oid = v_cmd::regprocedure
          AND acl.privilege_type = 'EXECUTE'
          AND r.rolname = 'authenticated'
          AND acl.is_grantable
      ) THEN
        RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: AUTHENTICATED_GRANT_OPTION_DENIED=NO on %', v_cmd;
      END IF;
    ELSIF has_function_privilege('authenticated', v_cmd, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: % still executable while quiesced — restore is 07D after VERIFY bodies',
        v_cmd;
    END IF;
    v_cmd_ok := v_cmd_ok + 1;
  END LOOP;
  IF v_cmd_ok <> 14 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT expected 14, got %',
      v_cmd_ok;
  END IF;

  FOREACH v_cmd IN ARRAY ARRAY[
    'public.wave5_ensure_athlete_for_club_member(uuid,text,text)',
    'public.wave5_resolve_club_facility_venue_id(text)'
  ]
  LOOP
    IF has_function_privilege('authenticated', v_cmd, 'EXECUTE')
       OR has_function_privilege('anon', v_cmd, 'EXECUTE')
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_proc p
         CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
         WHERE p.oid = v_cmd::regprocedure
           AND acl.privilege_type = 'EXECUTE'
           AND acl.grantee = 0
       ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: internal helper direct execute must be DENIED for PUBLIC/anon/authenticated: %',
        v_cmd;
    END IF;
  END LOOP;

  v_oid := to_regprocedure('public.club_leave_my_membership()');
  IF v_oid IS NOT NULL THEN
    IF has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_proc p
         CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
         WHERE p.oid = v_oid
           AND acl.privilege_type = 'EXECUTE'
           AND acl.grantee = 0
       ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_FAIL: LEGACY_LEAVE_MY_POST_CUTOVER_STATE expected QUIESCED_EXECUTE_DENIED';
    END IF;
  END IF;

  RAISE NOTICE 'WAVE5_VERIFY_OK clubs=% members=% gov=% req=% fk=platform_tenants POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14',
    v_club_count, v_member_count, v_gov_count, v_req_count;
END $$;

SELECT
  (SELECT count(*) FROM public.clubs) AS clubs_count,
  (SELECT count(*) FROM public.club_members) AS club_members_count,
  (SELECT count(*) FROM public.club_governance_assignments) AS club_governance_assignments_count,
  (SELECT count(*) FROM public.club_membership_requests_v42) AS club_membership_requests_v42_count,
  (SELECT count(*) FROM public.clubs c
    JOIN public.platform_tenants pt ON pt.id = c.tenant_id) AS clubs_canonical_tenant_count;
