-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Durable APPLIED → VERIFIED. Operator cannot manufacture VERIFIED by
-- running this file without a valid same-transaction recheck.
-- VERIFIED_STATE_CANNOT_BE_MANUFACTURED=YES
-- VERIFIED_GATE_CANONICAL_FK_COUNT=4
-- VERIFIED_GATE_MUTATION_RPC_COUNT=14
-- VERIFIED_GATE_EXACT_RPC_RESOLUTION=YES
-- VERIFIED_GATE_UNKNOWN_OVERLOAD=ABORT
-- VERIFIED_UNKNOWN_OVERLOAD_AUTHORITY=OID
-- CANONICAL_MUTATION_SURFACE_REF=09_CANONICAL_MUTATION_SURFACE.sql
-- 03_VERIFY.sql remains the operator report. This file is the durable gate.
-- KEEP_WRITES_QUIESCED=YES until 07D. Do not 07C from APPLIED/VERIFIED.

BEGIN;

DO $$
DECLARE
  v_batch uuid;
  v_state text;
  v_fk text;
  v_delete_rule text;
  v_table text;
  v_fk_ok int := 0;
  v_legacy_venue_fk int;
  v_non_canonical int;
  v_mismatch int;
  v_updated int := 0;
  v_sig text;
  v_oid regprocedure;
  v_cmd_ok int := 0;
  v_marker_fn text;
  v_create_fn text;
  v_helper_fn text;
  v_cluster_orphan int;
  v_cluster_xtenant int;
  v_prosecdef boolean;
  v_evidence text;
  v_unknown int := 0;
  v_overload int := 0;
BEGIN
  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: wave5.cutover_batch_id is not a uuid';
  END;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: explicit cutover_batch_id required';
  END IF;

  SELECT b.state INTO v_state
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch
    AND b.cutover_kind = 'WAVE5_CLUB_TENANT'
  FOR UPDATE;

  IF v_state IS DISTINCT FROM 'APPLIED' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: invalid transition % → VERIFIED',
      coalesce(v_state, '<missing>');
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    SELECT ccu.table_name, rc.delete_rule
      INTO v_fk, v_delete_rule
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
    IF v_fk IS DISTINCT FROM 'platform_tenants' THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: %.tenant_id FK is %, expected platform_tenants',
        v_table, coalesce(v_fk, '<null>');
    END IF;
    IF v_delete_rule IS DISTINCT FROM 'RESTRICT' THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: %.tenant_id delete rule is %, expected RESTRICT',
        v_table, coalesce(v_delete_rule, '<null>');
    END IF;
    v_fk_ok := v_fk_ok + 1;
  END LOOP;
  IF v_fk_ok <> 4 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: VERIFIED_GATE_CANONICAL_FK_COUNT expected 4, got %',
      v_fk_ok;
  END IF;

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
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: legacy Club tenant_id → venues(id) FK still present';
  END IF;

  SELECT count(*) INTO v_non_canonical
  FROM public.clubs c
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = c.tenant_id);
  IF v_non_canonical > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: % clubs.tenant_id are not platform_tenants.id',
      v_non_canonical;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM public.club_members cm
  JOIN public.clubs c ON c.id = cm.club_id
  WHERE cm.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: % club_members.tenant_id disagree with Club', v_mismatch;
  END IF;
  SELECT count(*) INTO v_mismatch
  FROM public.club_governance_assignments g
  JOIN public.clubs c ON c.id = g.club_id
  WHERE g.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: % governance tenant_id disagree with Club', v_mismatch;
  END IF;
  SELECT count(*) INTO v_mismatch
  FROM public.club_membership_requests_v42 r
  JOIN public.clubs c ON c.id = r.club_id
  WHERE r.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: % request tenant_id disagree with Club', v_mismatch;
  END IF;

  SELECT count(*) INTO v_overload
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'phase42_club_canonical';
  IF v_overload <> 1 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: VERIFIED_GATE_EXACT_RPC_RESOLUTION=NO phase42_club_canonical overload_count=%',
      v_overload;
  END IF;
  IF to_regprocedure('public.phase42_club_canonical(text)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: phase42_club_canonical(text) missing';
  END IF;
  v_marker_fn := pg_get_functiondef('public.phase42_club_canonical(text)'::regprocedure);
  IF v_marker_fn IS NULL OR v_marker_fn NOT ILIKE '%scope_semantics%'
     OR v_marker_fn NOT ILIKE '%canonical_tenant_id%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: phase42_club_canonical missing canonical marker';
  END IF;

  SELECT count(*) INTO v_overload
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_create';
  IF v_overload <> 1 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: VERIFIED_GATE_EXACT_RPC_RESOLUTION=NO club_create overload_count=%',
      v_overload;
  END IF;
  IF to_regprocedure('public.club_create(uuid,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: club_create exact signature missing';
  END IF;
  v_create_fn := pg_get_functiondef('public.club_create(uuid,text,text,text,text,text)'::regprocedure);
  IF v_create_fn IS NULL
     OR v_create_fn ~* 'from[[:space:]]+public\.venues[[:space:]]+v[[:space:]]+where[[:space:]]+v\.id[[:space:]]*='
     OR v_create_fn NOT ILIKE '%platform_tenants%' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: club_create canonical Tenant semantics missing';
  END IF;

  IF to_regprocedure('public.platform_is_canonical_tenant_entitled(text)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: canonical entitlement helper missing';
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
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: REGISTERED_CLUSTER_ORPHAN_COUNT=%', v_cluster_orphan;
  END IF;
  SELECT count(*) INTO v_cluster_xtenant
  FROM public.clubs c
  JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
  JOIN public.venues v ON v.id = cc.venue_id
  WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
    AND v.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_cluster_xtenant > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: REGISTERED_CLUSTER_CROSS_TENANT_COUNT=%', v_cluster_xtenant;
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.wave5_ensure_athlete_for_club_member(uuid,text,text)',
    'public.wave5_resolve_club_facility_venue_id(text)'
  ]
  LOOP
    v_oid := to_regprocedure(v_sig);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: Wave5 helper missing %', v_sig;
    END IF;
    SELECT p.prosecdef INTO v_prosecdef FROM pg_proc p WHERE p.oid = v_oid;
    IF v_prosecdef IS NOT TRUE THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: Wave5 helper must be SECURITY DEFINER %', v_sig;
    END IF;
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
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: internal helper application-role execute denied required for %',
        v_sig;
    END IF;
  END LOOP;

  SELECT pg_get_functiondef('public.wave5_resolve_club_facility_venue_id(text)'::regprocedure)
    INTO v_helper_fn;
  IF v_helper_fn !~ 'v\.tenant_id[[:space:]]*=[[:space:]]*c\.tenant_id' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: registered-cluster same-Tenant binding missing';
  END IF;

  -- WAVE5_UNKNOWN_MUTATION_OVERLOAD_GATE
  SELECT count(*) INTO v_unknown
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'club_create',
      'club_update',
      'club_assign_owner',
      'club_clear_owner',
      'club_transfer_president',
      'club_assign_vice_president',
      'club_clear_vice_president',
      'club_add_member',
      'club_remove_member',
      'club_restore_member',
      'club_leave_membership',
      'club_submit_membership_request',
      'club_cancel_membership_request',
      'club_review_membership_request',
      'club_leave_my_membership'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM (
        VALUES
          ('public.club_create(uuid,text,text,text,text,text)'::text),
          ('public.club_update(uuid,text,integer,text,text,text,text,text)'),
          ('public.club_assign_owner(uuid,text,uuid,integer)'),
          ('public.club_clear_owner(uuid,text,integer)'),
          ('public.club_transfer_president(uuid,text,uuid,integer)'),
          ('public.club_assign_vice_president(uuid,text,uuid,integer)'),
          ('public.club_clear_vice_president(uuid,text,integer,uuid)'),
          ('public.club_add_member(uuid,text,uuid,text,integer)'),
          ('public.club_remove_member(uuid,text,uuid,integer)'),
          ('public.club_restore_member(uuid,text,uuid,integer)'),
          ('public.club_leave_membership(uuid,text)'),
          ('public.club_submit_membership_request(uuid,text,text)'),
          ('public.club_cancel_membership_request(uuid,uuid,integer)'),
          ('public.club_review_membership_request(uuid,uuid,text,text,integer)'),
          ('public.club_leave_my_membership()')
      ) AS approved(sig)
      WHERE to_regprocedure(approved.sig)::oid = p.oid
    );
  IF v_unknown > 0 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: VERIFIED_GATE_UNKNOWN_OVERLOAD=ABORT UNKNOWN_MUTATION_RPC_OVERLOAD count=%',
      v_unknown;
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
    -- WAVE5_CANONICAL_14_ARRAY_BEGIN
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
    -- WAVE5_CANONICAL_14_ARRAY_END
  ]
  LOOP
    v_oid := to_regprocedure(v_sig);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: canonical mutation RPC missing %', v_sig;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE p.oid = v_oid
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee = 0
    ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: PUBLIC EXECUTE must be DENIED on %', v_sig;
    END IF;
    IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: anon EXECUTE must be DENIED on %', v_sig;
    END IF;
    IF has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: authenticated still executable while awaiting 07D: %',
        v_sig;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
       AND has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: service_role mutation state must remain quiesced on %',
        v_sig;
    END IF;
    v_cmd_ok := v_cmd_ok + 1;
  END LOOP;
  IF v_cmd_ok <> 14 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: VERIFIED_GATE_MUTATION_RPC_COUNT expected 14, got % — partial 3-RPC gate is insufficient',
      v_cmd_ok;
  END IF;

  v_oid := to_regprocedure('public.club_leave_my_membership()');
  IF v_oid IS NOT NULL THEN
    IF has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_oid, 'EXECUTE')
       OR (
         EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
         AND has_function_privilege('service_role', v_oid, 'EXECUTE')
       ) THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: legacy club_leave_my_membership remains denied required';
    END IF;
  END IF;

  v_evidence := md5(format(
    'fk=%s rpc=%s orphan=%s xtenant=%s mismatch=%s',
    v_fk_ok, v_cmd_ok, v_cluster_orphan, v_cluster_xtenant, v_mismatch
  ));

  UPDATE public.wave5_club_cutover_batch
  SET state = 'VERIFIED',
      verified_at = clock_timestamp(),
      verify_evidence_fingerprint = v_evidence
  WHERE batch_id = v_batch
    AND state = 'APPLIED';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: APPLIED → VERIFIED failed';
  END IF;

  RAISE NOTICE 'WAVE5_VERIFIED batch=% VERIFIED_STATE_CANNOT_BE_MANUFACTURED=YES VERIFIED_GATE_CANONICAL_FK_COUNT=4 VERIFIED_GATE_MUTATION_RPC_COUNT=14 evidence=%',
    v_batch, v_evidence;
END $$;

COMMIT;
