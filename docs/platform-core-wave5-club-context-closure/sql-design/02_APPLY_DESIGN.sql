-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
-- RLS_EXECUTED=NO
--
-- DESIGN CANDIDATE ONLY. Do not apply without a separate Owner GO.
-- Strongly state-guarded Club Tenant cutover.
--
-- 01_PRECHECK.sql = operator-facing dry-run evidence.
-- 02_APPLY_DESIGN.sql = self-protecting authoritative transactional migration.
-- APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO
-- APPLY does not trust a prior PRECHECK run. All mutation-critical invariants
-- are reasserted inside this locked transaction.
--
-- STATE_LEGACY: every in-scope Club tenant_id FK is public.venues(id)
--   → materialize map, validate, translate, retarget FK
-- STATE_CANONICAL: every in-scope Club tenant_id FK is public.platform_tenants(id)
--   → DO NOT translate data, DO NOT join Club tenant_id to venues.id as source
--   → CANONICAL_STATE_DATA_TRANSLATION=DENIED
--   → CANONICAL_STATE_INVARIANT_FAILURE=ABORT
-- STATE_UNKNOWN: mixed/other → hard abort
--
-- The DATA UPDATE itself is inside the STATE_LEGACY branch of the same DO block.
-- CANONICAL_STATE_CANNOT_EXECUTE_LEGACY_TRANSLATION=YES
-- Does NOT add clubs.venue_id.
-- Does NOT globally retire phase42_is_tenant_member.
-- Does NOT use venues.id = platform_tenants.id as a migration predicate.
-- DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
-- APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED
-- ROUND2_BLOCKER_01=REMEDIATED
-- ROUND2_BLOCKER_02=REMEDIATED
-- ROUND4_BLOCKER_01_CONCURRENT_WRITE_LOCKING=FIXED
-- ROUND4_BLOCKER_02_LOCKED_APPLY_SAFETY_GATE=FIXED
-- ROUND4_P2_TRIGGER_STATE_PRESERVATION=FIXED
-- CLUB_CUTOVER_TABLE_LOCK=YES
-- CLUB_CUTOVER_LOCK_MODE=ACCESS EXCLUSIVE
-- CLUB_CUTOVER_LOCK_ORDER=DETERMINISTIC
-- CUTOVER_LOCK_ORDER_PARENT_TO_CHILD=YES
-- LOCK_ORDER_INVERSION_REVIEW=PASS
-- UNBOUNDED_LOCK_WAIT=NO
-- STAGING_LOCK_TIMEOUT=5s
-- PRODUCTION_LOCK_TIMEOUT=15s
-- STAGING_RECOMMENDED_LOCK_TIMEOUT=5s
-- PRODUCTION_RECOMMENDED_LOCK_TIMEOUT=15s
-- PHASE_Q1_COMMITTED_WRITE_QUIESCE=REQUIRED
-- APPLY_REQUIRES_DURABLE_DRAIN_STATE=YES
-- APPLY_BATCH_ID_MATCH_REQUIRED=YES
-- ARBITRARY_DRAIN_PASS_GUC_NOT_SUFFICIENT=YES
-- APPLY_REQUIRES_DRAIN_PASS_ATTESTATION=NO
-- APPLY_REQUIRES_Q1_QUIESCE_VISIBLE=YES
-- RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES
-- EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10
-- NEW_WAVE5_FUNCTION_STRONG_GUARD_COUNT=3
-- CLUB_CUTOVER_CONCURRENT_WRITE_WINDOW=CLOSED
-- WAVE5_APPLY_ABORT_RPC_BODY_DRIFT=YES
-- EXISTING_FUNCTION_SIGNATURE_ONLY_NOT_ENOUGH=YES
-- APPLY_IN_TRANSACTION_FK_STATE_GUARD=YES
-- APPLY_EXPECTS_WAVE4_TENANT_MEMBERS_CANONICAL=YES
-- APPLY_IN_TRANSACTION_MAPPING_GUARD=YES
-- APPLY_IN_TRANSACTION_CHILD_CONSISTENCY_GUARD=YES
-- APPLY_IN_TRANSACTION_NAME_COLLISION_GUARD=YES
-- APPLY_IN_TRANSACTION_CODE_COLLISION_GUARD=YES
-- APPLY_IN_TRANSACTION_CLUSTER_ORPHAN_GUARD=YES
-- APPLY_IN_TRANSACTION_CLUSTER_CROSS_TENANT_GUARD=YES
-- APPLY_IN_TRANSACTION_RPC_SIGNATURE_GUARD=YES
-- TRIGGER_PRE_STATE_CAPTURED=YES
-- TRIGGER_POST_STATE_PRESERVED=YES
-- MUTATION_BEFORE_LOCKED_SAFETY_GATE=NO
-- PARTIAL_CUTOVER_COMMIT_POSSIBLE=NO
-- No internal COMMIT. No exception handler that commits partial work.
-- Transactional DDL (LOCK / ALTER TRIGGER / DROP/ADD FK) rolls back with the
-- transaction if any later statement fails.

BEGIN;

-- Bounded wait from reviewed wrapper GUC wave5.target_env only.
-- Do not SET LOCAL lock_timeout in this file to a hardcoded value.
-- Staging wrapper → 5s / 60s. Production wrapper → 15s / 180s.
DO $wave5_apply_timeout$
DECLARE
  v_env text := current_setting('wave5.target_env', true);
BEGIN
  IF v_env IS DISTINCT FROM 'staging' AND v_env IS DISTINCT FROM 'production' THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: wave5.target_env must be staging or production via reviewed wrapper';
  END IF;
  PERFORM set_config(
    'lock_timeout',
    CASE v_env WHEN 'staging' THEN '5s' WHEN 'production' THEN '15s' END,
    true
  );
  PERFORM set_config(
    'statement_timeout',
    CASE v_env WHEN 'staging' THEN '60s' WHEN 'production' THEN '180s' END,
    true
  );
END $wave5_apply_timeout$;

-- Durable DRAINED batch is the authority. wave5.drain_pass=YES is not sufficient.
-- Do not SET wave5.cutover_batch_id or wave5.drain_pass inside this file.
DO $wave5_apply_prelock$
DECLARE
  v_batch uuid;
  v_state text;
  v_kind text;
  v_q1 timestamptz;
  v_drained timestamptz;
  v_active int;
BEGIN
  IF current_setting('wave5.drain_pass', true) = 'YES'
     AND nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: ARBITRARY_DRAIN_PASS_GUC_NOT_SUFFICIENT — durable DRAINED batch_id required';
  END IF;

  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: APPLY_BATCH_ID_MATCH_REQUIRED — wave5.cutover_batch_id is not a uuid';
  END;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: APPLY_BATCH_ID_MATCH_REQUIRED — set wave5.cutover_batch_id';
  END IF;

  SELECT b.state, b.cutover_kind, b.q1_committed_at, b.drained_at
    INTO v_state, v_kind, v_q1, v_drained
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch;

  IF v_kind IS DISTINCT FROM 'WAVE5_CLUB_TENANT' THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: batch % is not WAVE5_CLUB_TENANT', v_batch;
  END IF;
  IF v_state IS DISTINCT FROM 'DRAINED' THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: APPLY_REQUIRES_DURABLE_DRAIN_STATE state=% (wave5.drain_pass cannot manufacture DRAINED)',
      coalesce(v_state, '<missing>');
  END IF;
  IF v_q1 IS NULL OR v_drained IS NULL OR v_drained <= v_q1 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: drained_at must be after q1_committed_at';
  END IF;

  SELECT count(*) INTO v_active
  FROM public.wave5_club_cutover_batch b
  WHERE b.cutover_kind = 'WAVE5_CLUB_TENANT'
    AND b.state NOT IN ('RESTORED', 'ABORTED');
  IF v_active <> 1 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: ONE_ACTIVE_CUTOVER_BATCH violated active=%', v_active;
  END IF;

  IF to_regprocedure('public.club_create(uuid,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: RPC_SIGNATURE_DRIFT club_create missing before lock';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'public.club_create(uuid,text,text,text,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: Q1 quiesce not visible — authenticated can still EXECUTE club_create (privilege drop must be a prior committed phase)';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'public.club_add_member(uuid,text,uuid,text,integer)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: Q1 quiesce not visible — authenticated can still EXECUTE club_add_member';
  END IF;
END $wave5_apply_prelock$;

-- =====================================================================
-- 0. Parent/supporting locks, then Club parent, then Club children.
--    SHARE ROW EXCLUSIVE: blocks ROW EXCLUSIVE writers; SELECT continues.
--    ACCESS EXCLUSIVE on Club-owned tables: blocks INSERT/UPDATE/DELETE/DDL.
--    tenant_members ACCESS SHARE: blocks ACCESS EXCLUSIVE DDL only.
--    DETERMINISTIC order is not a deadlock-freedom proof.
-- =====================================================================
LOCK TABLE
  public.platform_tenants,
  public.venues,
  public.court_clusters
IN SHARE ROW EXCLUSIVE MODE;

LOCK TABLE public.tenant_members IN ACCESS SHARE MODE;

LOCK TABLE
  public.clubs,
  public.club_members,
  public.club_governance_assignments,
  public.club_membership_requests_v42
IN ACCESS EXCLUSIVE MODE;

DO $wave5_apply_mark$
DECLARE
  v_updated int := 0;
BEGIN
  UPDATE public.wave5_club_cutover_batch
  SET state = 'APPLYING',
      apply_started_at = clock_timestamp()
  WHERE batch_id = nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid
    AND state = 'DRAINED'
    AND cutover_kind = 'WAVE5_CLUB_TENANT';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: DRAINED → APPLYING failed — APPLY_REQUIRES_DURABLE_DRAIN_STATE';
  END IF;
END $wave5_apply_mark$;

-- =====================================================================
-- 1. Schema-state machine + locked safety gate + data translation (ONE DO)
-- =====================================================================
DO $$
DECLARE
  v_clubs_fk text;
  v_members_fk text;
  v_gov_fk text;
  v_req_fk text;
  v_tm_fk text;
  v_delete_rule text;
  v_state text;
  v_fk_name text;
  v_fk_table text;
  v_clubs int;
  v_mapped int;
  v_bad int;
  v_mismatch int;
  v_orphan int;
  v_venue_missing_tenant int;
  v_tenant_unresolved int;
  v_ambiguous int;
  v_dup_name int;
  v_dup_code int;
  v_cluster_orphan int;
  v_cluster_xtenant int;
  v_overload int;
  v_rpc_def text;
  v_gov_tg_enabled "char";
  v_guard record;
  v_marker text;
  v_live_fp text;
  v_lanname text;
  v_prosecdef boolean;
  v_proconfig text[];
BEGIN
  IF to_regclass('public.clubs') IS NULL
     OR to_regclass('public.club_members') IS NULL
     OR to_regclass('public.club_governance_assignments') IS NULL
     OR to_regclass('public.club_membership_requests_v42') IS NULL
     OR to_regclass('public.venues') IS NULL
     OR to_regclass('public.platform_tenants') IS NULL
     OR to_regclass('public.court_clusters') IS NULL
     OR to_regclass('public.tenant_members') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: required tables missing';
  END IF;

  -- APPLY_IN_TRANSACTION_FK_STATE_GUARD=YES
  SELECT ccu.table_name INTO v_clubs_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  SELECT ccu.table_name INTO v_members_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  SELECT ccu.table_name INTO v_gov_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_governance_assignments'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  SELECT ccu.table_name INTO v_req_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_membership_requests_v42'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  IF v_clubs_fk IS NULL OR v_members_fk IS NULL OR v_gov_fk IS NULL OR v_req_fk IS NULL
     OR v_clubs_fk NOT IN ('venues', 'platform_tenants')
     OR v_members_fk NOT IN ('venues', 'platform_tenants')
     OR v_gov_fk NOT IN ('venues', 'platform_tenants')
     OR v_req_fk NOT IN ('venues', 'platform_tenants') THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: STATE_UNKNOWN clubs=% members=% gov=% req=%',
      coalesce(v_clubs_fk, '<null>'), coalesce(v_members_fk, '<null>'),
      coalesce(v_gov_fk, '<null>'), coalesce(v_req_fk, '<null>');
  END IF;

  IF v_clubs_fk = 'platform_tenants'
     AND v_members_fk = 'platform_tenants'
     AND v_gov_fk = 'platform_tenants'
     AND v_req_fk = 'platform_tenants' THEN
    v_state := 'CANONICAL';
  ELSIF v_clubs_fk = 'venues'
     AND v_members_fk = 'venues'
     AND v_gov_fk = 'venues'
     AND v_req_fk = 'venues' THEN
    v_state := 'LEGACY';
  ELSE
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: STATE_UNKNOWN mixed Club tenant FKs clubs=% members=% gov=% req=%',
      v_clubs_fk, v_members_fk, v_gov_fk, v_req_fk;
  END IF;

  -- APPLY_EXPECTS_WAVE4_TENANT_MEMBERS_CANONICAL=YES
  -- Do not repair Wave 4 here.
  SELECT ccu.table_name INTO v_tm_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'tenant_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;
  IF v_tm_fk IS DISTINCT FROM 'platform_tenants' THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: tenant_members.tenant_id FK is %, expected platform_tenants (Wave 4 closed canonical). WAVE4_SQL_REEXECUTION_REQUIRED=NO — do not repair here',
      coalesce(v_tm_fk, '<null>');
  END IF;

  SELECT rc.delete_rule INTO v_delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'tenant_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
    AND ccu.table_name = 'platform_tenants'
  LIMIT 1;
  IF v_delete_rule IS DISTINCT FROM 'RESTRICT' THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: tenant_members.tenant_id delete rule is %, expected RESTRICT',
      coalesce(v_delete_rule, '<null>');
  END IF;

  -- APPLY_IN_TRANSACTION_RPC_SIGNATURE_GUARD=YES
  -- Strong identity: signature + overload + prosecdef + search_path + language
  -- + md5(prosrc). Do not EXECUTE or regexp_replace the text.
  -- Certified fingerprints remain UNCERTIFIED until Owner reviews live PRECHECK evidence.
  -- APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED
  -- EXISTING_FUNCTION_SIGNATURE_ONLY_NOT_ENOUGH=YES
  -- EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10
  -- RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES
  FOR v_guard IN
    SELECT * FROM (VALUES
      ('public.phase42_club_canonical(text)', 'phase42_club_canonical',
       ARRAY['clubs', 'tenant_id'], 'plpgsql', 'UNCERTIFIED'),
      ('public.club_create(uuid,text,text,text,text,text)', 'club_create',
       ARRAY['phase42_idempotency', 'clubs', 'p_tenant_id'], 'plpgsql', 'UNCERTIFIED'),
      ('public.club_list_registry(text,boolean)', 'club_list_registry',
       ARRAY['phase42_club_canonical', 'clubs'], 'plpgsql', 'UNCERTIFIED'),
      ('public.club_list_members(text)', 'club_list_members',
       ARRAY['club_members'], 'plpgsql', 'UNCERTIFIED'),
      ('public.phase42_can_update_club(text)', 'phase42_can_update_club',
       ARRAY['clubs'], 'plpgsql', 'UNCERTIFIED'),
      ('public.phase42_can_assign_club_owner(text)', 'phase42_can_assign_club_owner',
       ARRAY['clubs'], 'plpgsql', 'UNCERTIFIED'),
      ('public.phase42_can_transfer_president(text)', 'phase42_can_transfer_president',
       ARRAY['clubs'], 'plpgsql', 'UNCERTIFIED'),
      ('public.club_add_member(uuid,text,uuid,text,integer)', 'club_add_member',
       ARRAY['phase42_can_review_membership', 'club_members', 'phase42_idempotency'], 'plpgsql', 'UNCERTIFIED'),
      ('public.club_restore_member(uuid,text,uuid,integer)', 'club_restore_member',
       ARRAY['phase42_can_review_membership', 'club_members'], 'plpgsql', 'UNCERTIFIED'),
      ('public.club_review_membership_request(uuid,uuid,text,text,integer)', 'club_review_membership_request',
       ARRAY['club_membership_requests_v42', 'VERSION_CONFLICT'], 'plpgsql', 'UNCERTIFIED')
    ) AS t(sig text, fname text, markers text[], lang text, certified_fp text)
  LOOP
    IF to_regprocedure(v_guard.sig) IS NULL THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: RPC_SIGNATURE_DRIFT % missing', v_guard.sig;
    END IF;
    SELECT count(*) INTO v_overload
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_guard.fname;
    IF v_overload <> 1 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: RPC_SIGNATURE_DRIFT % overload_count=%',
        v_guard.fname, v_overload;
    END IF;
    SELECT p.prosecdef, p.proconfig, md5(convert_to(p.prosrc, 'UTF8')), l.lanname
      INTO v_prosecdef, v_proconfig, v_live_fp, v_lanname
    FROM pg_proc p
    JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = v_guard.sig::regprocedure;
    IF v_prosecdef IS NOT TRUE THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: % prosecdef expected true', v_guard.fname;
    END IF;
    IF coalesce(array_to_string(v_proconfig, ','), '') NOT ILIKE '%search_path=public%' THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: % search_path not public', v_guard.fname;
    END IF;
    IF v_lanname IS DISTINCT FROM v_guard.lang THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: % language=% expected %',
        v_guard.fname, v_lanname, v_guard.lang;
    END IF;
    v_rpc_def := pg_get_functiondef(v_guard.sig::regprocedure);
    FOREACH v_marker IN ARRAY v_guard.markers LOOP
      IF position(v_marker in v_rpc_def) = 0 THEN
        RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: % missing certified marker %',
          v_guard.fname, v_marker;
      END IF;
    END LOOP;
    IF v_guard.certified_fp IS NULL
       OR v_guard.certified_fp = 'UNCERTIFIED'
       OR v_guard.certified_fp = 'OWNER_REVIEW_REQUIRED' THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: OWNER_REVIEW_REQUIRED % live_prosrc_md5=% RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES',
        v_guard.fname, v_live_fp;
    END IF;
    IF v_live_fp IS DISTINCT FROM v_guard.certified_fp THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: OWNER_REVIEW_REQUIRED % live_prosrc_md5=% certified=%',
        v_guard.fname, v_live_fp, v_guard.certified_fp;
    END IF;
  END LOOP;

  IF to_regprocedure('public.club_add_member(uuid,text,uuid,text,integer)') IS NULL
     OR to_regprocedure('public.club_restore_member(uuid,text,uuid,integer)') IS NULL
     OR to_regprocedure('public.club_review_membership_request(uuid,uuid,text,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: RPC_SIGNATURE_DRIFT member RPC missing after overwrite inventory';
  END IF;

  v_rpc_def := pg_get_functiondef('public.club_add_member(uuid,text,uuid,text,integer)'::regprocedure);
  IF position('wave5_ensure_athlete_for_club_member' in v_rpc_def) = 0
     AND position('phase42n_ensure_athlete_for_user' in v_rpc_def) = 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: club_add_member athlete-ensure call missing';
  END IF;

  -- NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED
  -- NEW_WAVE5_FUNCTION_STRONG_GUARD_COUNT=3
  -- signature alone is not enough; absent is valid; unknown body ABORT.
  IF to_regprocedure('public.platform_is_canonical_tenant_entitled(text)') IS NOT NULL THEN
    SELECT count(*) INTO v_overload
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'platform_is_canonical_tenant_entitled';
    IF v_overload <> 1 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: platform_is_canonical_tenant_entitled overload_count=%',
        v_overload;
    END IF;
    SELECT p.prosecdef, p.proconfig, md5(convert_to(p.prosrc, 'UTF8')), l.lanname
      INTO v_prosecdef, v_proconfig, v_live_fp, v_lanname
    FROM pg_proc p
    JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = 'public.platform_is_canonical_tenant_entitled(text)'::regprocedure;
    IF v_prosecdef IS NOT TRUE
       OR v_lanname IS DISTINCT FROM 'sql'
       OR coalesce(array_to_string(v_proconfig, ','), '') NOT ILIKE '%search_path=public%' THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: unexpected existing platform_is_canonical_tenant_entitled attributes';
    END IF;
    v_rpc_def := pg_get_functiondef('public.platform_is_canonical_tenant_entitled(text)'::regprocedure);
    IF position('tenant_members' in v_rpc_def) = 0
       OR position('phase42_is_platform_super_admin' in v_rpc_def) = 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: unexpected existing platform_is_canonical_tenant_entitled';
    END IF;
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: OWNER_REVIEW_REQUIRED platform_is_canonical_tenant_entitled live_prosrc_md5=%',
      v_live_fp;
  END IF;
  IF to_regprocedure('public.wave5_resolve_club_facility_venue_id(text)') IS NOT NULL THEN
    SELECT count(*) INTO v_overload
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'wave5_resolve_club_facility_venue_id';
    IF v_overload <> 1 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: wave5_resolve_club_facility_venue_id overload_count=%',
        v_overload;
    END IF;
    SELECT p.prosecdef, p.proconfig, md5(convert_to(p.prosrc, 'UTF8')), l.lanname
      INTO v_prosecdef, v_proconfig, v_live_fp, v_lanname
    FROM pg_proc p
    JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = 'public.wave5_resolve_club_facility_venue_id(text)'::regprocedure;
    IF v_prosecdef IS NOT TRUE
       OR v_lanname IS DISTINCT FROM 'plpgsql'
       OR coalesce(array_to_string(v_proconfig, ','), '') NOT ILIKE '%search_path=public%' THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: unexpected existing wave5_resolve_club_facility_venue_id attributes';
    END IF;
    v_rpc_def := pg_get_functiondef('public.wave5_resolve_club_facility_venue_id(text)'::regprocedure);
    IF position('registered_cluster_id' in v_rpc_def) = 0
       OR position('REGISTERED_CLUSTER_TENANT_MISMATCH' in v_rpc_def) = 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: unexpected existing wave5_resolve_club_facility_venue_id';
    END IF;
    IF has_function_privilege('authenticated', 'public.wave5_resolve_club_facility_venue_id(text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.wave5_resolve_club_facility_venue_id(text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: wave5_resolve_club_facility_venue_id callable by application role';
    END IF;
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: OWNER_REVIEW_REQUIRED wave5_resolve_club_facility_venue_id live_prosrc_md5=%',
      v_live_fp;
  END IF;
  IF to_regprocedure('public.wave5_ensure_athlete_for_club_member(uuid,text,text)') IS NOT NULL THEN
    SELECT count(*) INTO v_overload
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'wave5_ensure_athlete_for_club_member';
    IF v_overload <> 1 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: wave5_ensure_athlete_for_club_member overload_count=%',
        v_overload;
    END IF;
    SELECT p.prosecdef, p.proconfig, md5(convert_to(p.prosrc, 'UTF8')), l.lanname
      INTO v_prosecdef, v_proconfig, v_live_fp, v_lanname
    FROM pg_proc p
    JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = 'public.wave5_ensure_athlete_for_club_member(uuid,text,text)'::regprocedure;
    IF v_prosecdef IS NOT TRUE
       OR v_lanname IS DISTINCT FROM 'plpgsql'
       OR coalesce(array_to_string(v_proconfig, ','), '') NOT ILIKE '%search_path=public%' THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: unexpected existing wave5_ensure_athlete_for_club_member attributes';
    END IF;
    v_rpc_def := pg_get_functiondef('public.wave5_ensure_athlete_for_club_member(uuid,text,text)'::regprocedure);
    IF position('ATHLETE_FACILITY_VENUE_REQUIRED' in v_rpc_def) = 0
       OR position('wave5_resolve_club_facility_venue_id' in v_rpc_def) = 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: unexpected existing wave5_ensure_athlete_for_club_member';
    END IF;
    IF has_function_privilege('authenticated', 'public.wave5_ensure_athlete_for_club_member(uuid,text,text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.wave5_ensure_athlete_for_club_member(uuid,text,text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: wave5_ensure_athlete_for_club_member callable by application role';
    END IF;
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: OWNER_REVIEW_REQUIRED wave5_ensure_athlete_for_club_member live_prosrc_md5=%',
      v_live_fp;
  END IF;

  -- APPLY_IN_TRANSACTION_CHILD_CONSISTENCY_GUARD=YES
  SELECT count(*) INTO v_mismatch
  FROM public.club_members cm
  JOIN public.clubs c ON c.id = cm.club_id
  WHERE cm.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % club_members.tenant_id disagree with parent Club', v_mismatch;
  END IF;
  SELECT count(*) INTO v_mismatch
  FROM public.club_governance_assignments g
  JOIN public.clubs c ON c.id = g.club_id
  WHERE g.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % governance tenant_id disagree with parent Club', v_mismatch;
  END IF;
  SELECT count(*) INTO v_mismatch
  FROM public.club_membership_requests_v42 r
  JOIN public.clubs c ON c.id = r.club_id
  WHERE r.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % request tenant_id disagree with parent Club', v_mismatch;
  END IF;

  SELECT count(*) INTO v_clubs FROM public.clubs;

  IF v_state = 'CANONICAL' THEN
    -- APPLY_IN_TRANSACTION_MAPPING_GUARD=YES (canonical: tenant_id is already platform_tenants.id)
    SELECT count(*) INTO v_orphan FROM public.clubs c
    WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = c.tenant_id);
    IF v_orphan > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % clubs.tenant_id are not platform_tenants.id', v_orphan;
    END IF;

    -- APPLY_IN_TRANSACTION_NAME_COLLISION_GUARD=YES
    SELECT count(*) INTO v_dup_name FROM (
      SELECT c.tenant_id, lower(c.name)
      FROM public.clubs c
      WHERE c.deleted_at IS NULL
      GROUP BY c.tenant_id, lower(c.name)
      HAVING count(*) > 1
    ) d;
    IF v_dup_name > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: POST_MAP_DUPLICATE_CLUB_NAME_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_dup_name;
    END IF;

    -- APPLY_IN_TRANSACTION_CODE_COLLISION_GUARD=YES
    SELECT count(*) INTO v_dup_code FROM (
      SELECT c.tenant_id, c.code
      FROM public.clubs c
      WHERE c.deleted_at IS NULL AND c.code IS NOT NULL
      GROUP BY c.tenant_id, c.code
      HAVING count(*) > 1
    ) d;
    IF v_dup_code > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: POST_MAP_DUPLICATE_CLUB_CODE_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_dup_code;
    END IF;

    -- APPLY_IN_TRANSACTION_CLUSTER_ORPHAN_GUARD=YES
    -- APPLY_IN_TRANSACTION_CLUSTER_CROSS_TENANT_GUARD=YES
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
    SELECT count(*) INTO v_cluster_xtenant
    FROM public.clubs c
    JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
    JOIN public.venues v ON v.id = cc.venue_id
    WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
      AND v.tenant_id IS DISTINCT FROM c.tenant_id;
    IF v_cluster_orphan > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: REGISTERED_CLUSTER_ORPHAN_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_cluster_orphan;
    END IF;
    IF v_cluster_xtenant > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: REGISTERED_CLUSTER_CROSS_TENANT_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_cluster_xtenant;
    END IF;
  ELSE
    -- STATE_LEGACY mapping/collision/cluster under lock.
    -- APPLY_IN_TRANSACTION_MAPPING_GUARD=YES
    SELECT count(*) INTO v_orphan
    FROM public.clubs c
    WHERE c.tenant_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = c.tenant_id);
    IF v_orphan > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % club tenant_id values do not resolve to venues.id', v_orphan;
    END IF;

    SELECT count(*) INTO v_venue_missing_tenant
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    WHERE v.tenant_id IS NULL OR btrim(v.tenant_id) = '';
    IF v_venue_missing_tenant > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % clubs map to venues with null tenant_id', v_venue_missing_tenant;
    END IF;

    SELECT count(*) INTO v_tenant_unresolved
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = v.tenant_id);
    IF v_tenant_unresolved > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % clubs map to venues.tenant_id not in platform_tenants', v_tenant_unresolved;
    END IF;

    SELECT count(*) INTO v_ambiguous
    FROM (
      SELECT c.id
      FROM public.clubs c
      JOIN public.venues v ON v.id = c.tenant_id
      GROUP BY c.id
      HAVING count(DISTINCT v.tenant_id) > 1
    ) amb;
    IF v_ambiguous > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % clubs have non-deterministic canonical Tenant mapping', v_ambiguous;
    END IF;

    SELECT count(*) INTO v_mapped
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    JOIN public.platform_tenants pt ON pt.id = v.tenant_id;
    IF v_mapped <> v_clubs THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: mapping incomplete clubs=% mapped=%', v_clubs, v_mapped;
    END IF;

    -- APPLY_IN_TRANSACTION_NAME_COLLISION_GUARD=YES
    SELECT count(*) INTO v_dup_name FROM (
      SELECT v.tenant_id AS canonical_tenant_id, lower(c.name) AS normalized_name
      FROM public.clubs c
      JOIN public.venues v ON v.id = c.tenant_id
      WHERE c.deleted_at IS NULL
      GROUP BY v.tenant_id, lower(c.name)
      HAVING count(*) > 1
    ) d;
    IF v_dup_name > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: POST_MAP_DUPLICATE_CLUB_NAME_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_dup_name;
    END IF;

    -- APPLY_IN_TRANSACTION_CODE_COLLISION_GUARD=YES
    SELECT count(*) INTO v_dup_code FROM (
      SELECT v.tenant_id AS canonical_tenant_id, c.code
      FROM public.clubs c
      JOIN public.venues v ON v.id = c.tenant_id
      WHERE c.deleted_at IS NULL AND c.code IS NOT NULL
      GROUP BY v.tenant_id, c.code
      HAVING count(*) > 1
    ) d;
    IF v_dup_code > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: POST_MAP_DUPLICATE_CLUB_CODE_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_dup_code;
    END IF;

    -- APPLY_IN_TRANSACTION_CLUSTER_ORPHAN_GUARD=YES
    -- APPLY_IN_TRANSACTION_CLUSTER_CROSS_TENANT_GUARD=YES
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
    SELECT count(*) INTO v_cluster_xtenant
    FROM public.clubs c
    JOIN public.venues club_v ON club_v.id = c.tenant_id
    JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
    JOIN public.venues cluster_v ON cluster_v.id = cc.venue_id
    WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
      AND club_v.tenant_id IS DISTINCT FROM cluster_v.tenant_id;
    IF v_cluster_orphan > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: REGISTERED_CLUSTER_ORPHAN_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_cluster_orphan;
    END IF;
    IF v_cluster_xtenant > 0 THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: REGISTERED_CLUSTER_CROSS_TENANT_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_cluster_xtenant;
    END IF;
  END IF;

  RAISE NOTICE 'APPLY_LOCKED_SAFETY_GATE_COMPLETE state=%', v_state;

  -- TRIGGER_PRE_STATE_CAPTURED=YES — exact pg_trigger.tgenabled (O/D/R/A), not a boolean.
  SELECT t.tgenabled INTO v_gov_tg_enabled
  FROM pg_trigger t
  WHERE t.tgname = 'trg_phase42_gov_active_member'
    AND t.tgrelid = 'public.club_governance_assignments'::regclass
    AND NOT t.tgisinternal
  LIMIT 1;
  IF v_gov_tg_enabled IS NOT NULL AND v_gov_tg_enabled NOT IN ('O', 'D', 'R', 'A') THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: unknown trg_phase42_gov_active_member tgenabled=%', v_gov_tg_enabled;
  END IF;

  IF v_state = 'CANONICAL' THEN
    RAISE NOTICE 'WAVE5_APPLY_SKIP_TRANSLATE: Club-owned tenant_id already canonical — no Venue join, no data rewrite';
    -- STATE_CANONICAL: functions/policies below remain rerunnable after this DO returns.
    RETURN;
  END IF;

  -- STATE_LEGACY only from here. DATA UPDATE cannot run in CANONICAL/UNKNOWN.
  EXECUTE $map$
    CREATE TEMP TABLE wave5_club_tenant_map ON COMMIT DROP AS
    SELECT
      c.id AS club_id,
      c.tenant_id AS legacy_venue_scope_id,
      v.tenant_id AS canonical_tenant_id
    FROM public.clubs c
    LEFT JOIN public.venues v ON v.id = c.tenant_id
  $map$;

  SELECT count(*) INTO v_mapped
  FROM wave5_club_tenant_map
  WHERE canonical_tenant_id IS NOT NULL;
  IF v_clubs <> v_mapped THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: mapping incomplete clubs=% mapped=%', v_clubs, v_mapped;
  END IF;

  SELECT count(*) INTO v_bad
  FROM wave5_club_tenant_map m
  WHERE m.canonical_tenant_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.platform_tenants pt WHERE pt.id = m.canonical_tenant_id
     );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % clubs lack a canonical Tenant', v_bad;
  END IF;

  FOR v_fk_name, v_fk_table IN
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN (
        'clubs', 'club_members', 'club_governance_assignments', 'club_membership_requests_v42'
      )
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'venues'
  LOOP
    IF v_fk_table NOT IN (
      'clubs', 'club_members', 'club_governance_assignments', 'club_membership_requests_v42'
    ) THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: unexpected legacy FK table %', v_fk_table;
    END IF;
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_fk_table, v_fk_name);
  END LOOP;

  IF v_gov_tg_enabled IS NOT NULL AND v_gov_tg_enabled <> 'D' THEN
    EXECUTE 'ALTER TABLE public.club_governance_assignments DISABLE TRIGGER trg_phase42_gov_active_member';
  END IF;

  UPDATE public.clubs c
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE c.id = m.club_id
    AND c.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  UPDATE public.club_members cm
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE cm.club_id = m.club_id
    AND cm.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  UPDATE public.club_governance_assignments g
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE g.club_id = m.club_id
    AND g.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  UPDATE public.club_membership_requests_v42 r
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE r.club_id = m.club_id
    AND r.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  -- TRIGGER_POST_STATE_PRESERVED=YES — restore exact tgenabled, never unconditional ENABLE.
  IF v_gov_tg_enabled = 'O' THEN
    EXECUTE 'ALTER TABLE public.club_governance_assignments ENABLE TRIGGER trg_phase42_gov_active_member';
  ELSIF v_gov_tg_enabled = 'D' THEN
    EXECUTE 'ALTER TABLE public.club_governance_assignments DISABLE TRIGGER trg_phase42_gov_active_member';
  ELSIF v_gov_tg_enabled = 'R' THEN
    EXECUTE 'ALTER TABLE public.club_governance_assignments ENABLE REPLICA TRIGGER trg_phase42_gov_active_member';
  ELSIF v_gov_tg_enabled = 'A' THEN
    EXECUTE 'ALTER TABLE public.club_governance_assignments ENABLE ALWAYS TRIGGER trg_phase42_gov_active_member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'clubs'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'club_members'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.club_members
      ADD CONSTRAINT club_members_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'club_governance_assignments'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.club_governance_assignments
      ADD CONSTRAINT club_governance_assignments_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'club_membership_requests_v42'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.club_membership_requests_v42
      ADD CONSTRAINT club_membership_requests_v42_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  ALTER TABLE public.clubs ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE public.club_members ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE public.club_governance_assignments ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE public.club_membership_requests_v42 ALTER COLUMN tenant_id SET NOT NULL;
END $$;

-- =====================================================================
-- 2. Canonical Tenant entitlement (reuse tenant_members — not Club-specific)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.platform_is_canonical_tenant_entitled(p_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.phase42_is_platform_super_admin(), false)
         OR exists (
           SELECT 1
           FROM public.tenant_members tm
           WHERE tm.tenant_id = p_tenant_id
             AND tm.user_id = auth.uid()
             AND tm.status = 'active'
         );
$$;

REVOKE ALL ON FUNCTION public.platform_is_canonical_tenant_entitled(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_is_canonical_tenant_entitled(text) TO authenticated;

-- Honest facility-Venue translation for Participant athlete rows.
-- athletes.tenant_id remains Venue-scoped. Never pass Club Tenant as venues.id.
-- WAVE5_ATHLETE_COMPAT_REQUIRED
-- ATHLETE_NO_CLUSTER_POLICY:
--   existing athlete for user_id → reuse (Participant unique user_id), no Venue required
--   new athlete → require registered_cluster_id → court_clusters.venue_id → venues.id
--     AND venues.tenant_id = clubs.tenant_id (canonical Platform Tenant after cutover)
--   else fail closed ATHLETE_FACILITY_VENUE_REQUIRED
--   cross-Tenant cluster: ATHLETE_FACILITY_VENUE_REQUIRED: REGISTERED_CLUSTER_TENANT_MISMATCH
--   no Tenant-as-Venue, no first/default Venue, no clubs.venue_id, no profiles.venue_id from this wrapper
-- WAVE5_ATHLETE_HELPER_DIRECT_AUTHENTICATED_EXECUTE=DENY
CREATE OR REPLACE FUNCTION public.wave5_resolve_club_facility_venue_id(p_club_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id text;
BEGIN
  SELECT cc.venue_id
    INTO v_venue_id
  FROM public.clubs c
  INNER JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
  INNER JOIN public.venues v ON v.id = cc.venue_id
  WHERE c.id = p_club_id
    AND c.registered_cluster_id IS NOT NULL
    AND v.tenant_id = c.tenant_id
  LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    RETURN v_venue_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clubs c
    INNER JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
    INNER JOIN public.venues v ON v.id = cc.venue_id
    WHERE c.id = p_club_id
      AND c.registered_cluster_id IS NOT NULL
      AND v.tenant_id IS DISTINCT FROM c.tenant_id
  ) THEN
    RAISE EXCEPTION 'ATHLETE_FACILITY_VENUE_REQUIRED: REGISTERED_CLUSTER_TENANT_MISMATCH';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.wave5_ensure_athlete_for_club_member(
  p_user_id uuid,
  p_club_id text,
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_athlete_id uuid;
  v_venue_id text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'phase42n_ensure_athlete_for_user: p_user_id required';
  END IF;

  -- A. Existing Athlete is reusable regardless of Club facility Venue.
  SELECT a.id INTO v_athlete_id
  FROM public.athletes a
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at ASC
  LIMIT 1;
  IF v_athlete_id IS NOT NULL THEN
    RETURN v_athlete_id;
  END IF;

  -- C. Creation requires independently resolved physical Venue.
  v_venue_id := public.wave5_resolve_club_facility_venue_id(p_club_id);
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'ATHLETE_FACILITY_VENUE_REQUIRED';
  END IF;

  RETURN public.phase42n_ensure_athlete_for_user(p_user_id, v_venue_id, p_display_name);
END;
$$;

-- Internal SECURITY DEFINER helpers. Outer Club RPCs remain the caller-facing authority.
-- PostgreSQL checks nested EXECUTE as the SECURITY DEFINER owner, not the session user,
-- so authenticated may call club_add_member / club_restore_member /
-- club_review_membership_request without direct EXECUTE on these internals.
-- Convention matches phase42n_ensure_athlete_for_user: service_role only.
REVOKE ALL ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) TO service_role;

-- =====================================================================
-- 3. Club RPC: tenant_id is canonical Platform Tenant
-- =====================================================================
CREATE OR REPLACE FUNCTION public.phase42_club_canonical(p_club_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club public.clubs%rowtype;
  v_owner_name text;
  v_president_name text;
  v_owner_user uuid;
  v_president_user uuid;
  v_member_count int;
BEGIN
  SELECT * INTO v_club FROM public.clubs WHERE id = p_club_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT cm.user_id, coalesce(p.display_name, p.email, cm.user_id::text)
    INTO v_owner_user, v_owner_name
  FROM public.club_governance_assignments g
  JOIN public.club_members cm ON cm.id = g.club_member_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE g.club_id = p_club_id AND g.status = 'active' AND g.role_code = 'club_owner'
  LIMIT 1;

  SELECT cm.user_id, coalesce(p.display_name, p.email, cm.user_id::text)
    INTO v_president_user, v_president_name
  FROM public.club_governance_assignments g
  JOIN public.club_members cm ON cm.id = g.club_member_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE g.club_id = p_club_id AND g.status = 'active' AND g.role_code = 'president'
  LIMIT 1;

  SELECT count(*)::int INTO v_member_count
  FROM public.club_members
  WHERE club_id = p_club_id AND status = 'active';

  RETURN jsonb_build_object(
    'id', v_club.id,
    'tenant_id', v_club.tenant_id,
    'canonical_tenant_id', v_club.tenant_id,
    'scope_semantics', 'canonical_platform_tenant',
    'legacy_venue_scope_id', NULL,
    'name', v_club.name,
    'code', v_club.code,
    'description', v_club.description,
    'status', v_club.status,
    'registered_cluster_id', v_club.registered_cluster_id,
    'version', v_club.version,
    'created_by_user_id', v_club.created_by_user_id,
    'created_at', v_club.created_at,
    'updated_at', v_club.updated_at,
    'owner_user_id', v_owner_user,
    'owner_label', v_owner_name,
    'president_user_id', v_president_user,
    'president_label', v_president_name,
    'active_member_count', v_member_count
  );
END;
$$;

-- p_tenant_id means PLATFORM TENANT ID. Must NOT require venues.id == tenant id.
CREATE OR REPLACE FUNCTION public.club_create(
  p_request_id uuid,
  p_tenant_id text,
  p_name text,
  p_code text DEFAULT NULL,
  p_description text DEFAULT '',
  p_registered_cluster_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached jsonb;
  v_name text := trim(coalesce(p_name, ''));
  v_code text := nullif(trim(coalesce(p_code, '')), '');
  v_tenant text := trim(coalesce(p_tenant_id, ''));
  v_cluster text := nullif(trim(coalesce(p_registered_cluster_id, '')), '');
  v_club_id text;
  v_member_id uuid;
  v_resp jsonb;
  v_limit json;
  v_is_sa boolean := public.phase42_is_platform_super_admin();
  v_assign_president boolean := public.phase42_creator_gets_president();
  v_platform_role text;
  v_cluster_venue text;
  v_cluster_tenant text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;
  IF p_request_id IS NULL THEN
    RETURN public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  END IF;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_create');
  IF v_cached IS NOT NULL THEN
    RETURN v_cached::json;
  END IF;

  IF v_tenant = '' OR NOT EXISTS (
    SELECT 1 FROM public.platform_tenants pt WHERE pt.id = v_tenant
  ) THEN
    RETURN public.phase42_err('TENANT_NOT_FOUND', 'Không tìm thấy tenant.');
  END IF;

  IF NOT public.phase42_can_create_in_tenant(v_tenant) THEN
    RETURN public.phase42_err('TENANT_FORBIDDEN', 'Không có quyền tạo CLB trong tenant này.');
  END IF;

  IF NOT v_is_sa AND NOT public.user_has_permission('club.create') THEN
    RETURN public.phase42_err('FORBIDDEN', 'Thiếu permission club.create.');
  END IF;

  v_limit := public.phase42_check_club_plan_limit(v_tenant);
  IF coalesce((v_limit->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_limit;
  END IF;

  IF v_name = '' THEN
    RETURN public.phase42_err('NAME_REQUIRED', 'Thiếu tên CLB.');
  END IF;

  IF v_cluster IS NOT NULL THEN
    IF to_regclass('public.court_clusters') IS NULL THEN
      RETURN public.phase42_err('CLUSTER_NOT_FOUND', 'Không tìm thấy cụm sân.');
    END IF;
    SELECT cc.venue_id, v.tenant_id
      INTO v_cluster_venue, v_cluster_tenant
    FROM public.court_clusters cc
    JOIN public.venues v ON v.id = cc.venue_id
    WHERE cc.id = v_cluster;
    IF v_cluster_venue IS NULL THEN
      RETURN public.phase42_err('CLUSTER_NOT_FOUND', 'Không tìm thấy cụm sân.');
    END IF;
    IF v_cluster_tenant IS DISTINCT FROM v_tenant THEN
      RETURN public.phase42_err('CLUSTER_TENANT_MISMATCH', 'Cụm sân không thuộc tenant này.');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.tenant_id = v_tenant
      AND c.deleted_at IS NULL
      AND lower(c.name) = lower(v_name)
  ) THEN
    RETURN public.phase42_err('DUPLICATE_NAME', 'Tên CLB đã tồn tại trong tenant này.');
  END IF;

  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.tenant_id = v_tenant
      AND c.deleted_at IS NULL
      AND c.code = v_code
  ) THEN
    RETURN public.phase42_err('DUPLICATE_CODE', 'Mã CLB đã tồn tại trong tenant này.');
  END IF;

  SELECT upper(coalesce(role, '')) INTO v_platform_role
  FROM public.profiles WHERE id = auth.uid();

  v_club_id := 'club-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.clubs (
    id, tenant_id, name, code, description, status,
    registered_cluster_id, created_by_user_id, version
  ) VALUES (
    v_club_id, v_tenant, v_name, v_code, coalesce(p_description, ''),
    'active', v_cluster, auth.uid(), 1
  );

  IF NOT v_is_sa THEN
    INSERT INTO public.club_members (
      tenant_id, club_id, user_id, membership_type, status, version
    ) VALUES (
      v_tenant, v_club_id, auth.uid(), 'regular', 'active', 1
    )
    RETURNING id INTO v_member_id;

    INSERT INTO public.club_governance_assignments (
      tenant_id, club_id, club_member_id, role_code, status, version
    ) VALUES (
      v_tenant, v_club_id, v_member_id, 'club_owner', 'active', 1
    );

    IF v_assign_president THEN
      INSERT INTO public.club_governance_assignments (
        tenant_id, club_id, club_member_id, role_code, status, version
      ) VALUES (
        v_tenant, v_club_id, v_member_id, 'president', 'active', 1
      );
    END IF;
  END IF;

  PERFORM public.phase42_write_audit(
    'club.create',
    'club',
    v_club_id,
    v_tenant,
    v_club_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'super_admin_no_member', v_is_sa,
      'creator_member_id', v_member_id,
      'assigned_owner', NOT v_is_sa,
      'assigned_president', (NOT v_is_sa AND v_assign_president),
      'platform_role_unchanged', v_platform_role,
      'owner_scope', 'club_only',
      'scope_semantics', 'canonical_platform_tenant'
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club_id),
    'version', 1
  );

  PERFORM public.phase42_idempotency_put(p_request_id, v_tenant, 'club_create', v_name, v_resp);
  RETURN v_resp::json;

EXCEPTION
  WHEN unique_violation THEN
    RETURN public.phase42_err('DUPLICATE_CLUB', 'CLB trùng tên hoặc mã trong tenant.');
  WHEN raise_exception THEN
    RETURN public.phase42_err('CREATE_FAILED', sqlerrm);
  WHEN others THEN
    RETURN public.phase42_err('CREATE_FAILED', coalesce(sqlerrm, 'Không tạo được CLB.'));
END;
$$;

CREATE OR REPLACE FUNCTION public.club_list_registry(
  p_tenant_id text DEFAULT NULL,
  p_include_inactive boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  SELECT coalesce(jsonb_agg(public.phase42_club_canonical(c.id) ORDER BY c.name), '[]'::jsonb)
    INTO v_rows
  FROM public.clubs c
  WHERE c.deleted_at IS NULL
    AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (p_include_inactive OR c.status = 'active')
    AND (
      public.phase42_is_platform_super_admin()
      OR public.platform_is_canonical_tenant_entitled(c.tenant_id)
    );

  RETURN json_build_object('ok', true, 'data', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.club_list_members(p_club_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club public.clubs%rowtype;
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  SELECT * INTO v_club FROM public.clubs WHERE id = trim(coalesce(p_club_id, '')) AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  END IF;

  IF NOT (
    public.phase42_is_platform_super_admin()
    OR public.platform_is_canonical_tenant_entitled(v_club.tenant_id)
    OR public.phase42_active_club_member_id(v_club.id) IS NOT NULL
  ) THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền xem thành viên.');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', cm.id,
    'user_id', cm.user_id,
    'display_name', coalesce(p.display_name, p.email, cm.user_id::text),
    'status', cm.status,
    'membership_type', cm.membership_type,
    'governance_roles', coalesce((
      SELECT jsonb_agg(g.role_code)
      FROM public.club_governance_assignments g
      WHERE g.club_member_id = cm.id AND g.status = 'active'
    ), '[]'::jsonb),
    'joined_at', cm.joined_at,
    'version', cm.version
  ) ORDER BY cm.joined_at), '[]'::jsonb)
    INTO v_rows
  FROM public.club_members cm
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.club_id = v_club.id;

  RETURN json_build_object('ok', true, 'data', v_rows);
END;
$$;

-- Club authz helpers: keep tenant_owner via tenant_members; remove Venue ID == Tenant ID.
CREATE OR REPLACE FUNCTION public.phase42_can_update_club(p_club_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.phase42_is_platform_super_admin()
    OR public.phase42_has_gov_role(p_club_id, ARRAY['club_owner', 'president'])
    OR EXISTS (
      SELECT 1
      FROM public.clubs c
      WHERE c.id = p_club_id
        AND c.deleted_at IS NULL
        AND public.user_has_permission('club.update')
        AND public.platform_is_canonical_tenant_entitled(c.tenant_id)
        AND EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = c.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role_code = 'tenant_owner'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.phase42_can_assign_club_owner(p_club_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.phase42_is_platform_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.clubs c
      WHERE c.id = p_club_id
        AND c.deleted_at IS NULL
        AND (
          public.user_has_permission('club.governance.assign_owner')
          OR public.user_has_permission('club.update')
        )
        AND EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = c.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role_code = 'tenant_owner'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.phase42_can_transfer_president(p_club_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.phase42_is_platform_super_admin()
    OR public.phase42_has_gov_role(p_club_id, ARRAY['club_owner', 'president'])
    OR EXISTS (
      SELECT 1
      FROM public.clubs c
      WHERE c.id = p_club_id
        AND c.deleted_at IS NULL
        AND public.user_has_permission('club.update')
        AND EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = c.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role_code = 'tenant_owner'
        )
    );
$$;

-- WAVE5_ATHLETE_COMPAT_REQUIRED — explicit reviewed Club RPC bodies.
-- DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
-- Authoritative sources:
--   club_add_member: docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql
--   club_restore_member: docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql
--   club_review_membership_request: docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql
-- Wave 5 delta only: athlete ensure via wave5_ensure_athlete_for_club_member (Club id, not Club tenant_id).

CREATE OR REPLACE FUNCTION public.club_add_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_membership_type text default 'regular',
  p_expected_version integer default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_member public.club_members%rowtype;
  v_left public.club_members%rowtype;
  v_membership_type text;
  v_athlete_id uuid;
  v_display_name text;
  v_reactivated boolean := false;
  v_resp jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN public.phase42_err('VALIDATION', 'Thiếu target user_id.');
  END IF;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_add_member');
  IF v_cached IS NOT NULL THEN
    RETURN v_cached::json;
  END IF;

  SELECT * INTO v_club
  FROM public.clubs
  WHERE id = trim(coalesce(p_club_id, ''))
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  END IF;

  IF NOT (
    public.phase42_is_platform_super_admin()
    OR public.phase42_can_review_membership(v_club.id)
  ) THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền thêm thành viên.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy người dùng đích.');
  END IF;

  v_membership_type := nullif(trim(coalesce(p_membership_type, '')), '');
  IF v_membership_type IS NULL THEN
    v_membership_type := 'regular';
  END IF;

  SELECT * INTO v_member
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'active'
  FOR UPDATE;
  IF FOUND THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  END IF;

  SELECT * INTO v_left
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'left'
  ORDER BY left_at DESC NULLS LAST, updated_at DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND v_left.version IS DISTINCT FROM p_expected_version THEN
      RETURN public.phase42_err('VERSION_CONFLICT', 'Phiên bản thành viên đã thay đổi.');
    END IF;

    SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      INTO v_display_name
    FROM public.profiles p
    WHERE p.id = p_target_user_id;

    v_athlete_id := coalesce(
      v_left.athlete_id,
      public.wave5_ensure_athlete_for_club_member(
        p_target_user_id,
        v_club.id,
        v_display_name
      )
    );

    UPDATE public.club_members
    SET status = 'active',
        left_at = NULL,
        membership_type = v_membership_type,
        athlete_id = v_athlete_id,
        joined_at = coalesce(joined_at, now()),
        version = version + 1,
        updated_at = now()
    WHERE id = v_left.id
    RETURNING * INTO v_member;

    v_reactivated := true;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_id = v_club.id
        AND user_id = p_target_user_id
        AND status = 'removed'
    ) THEN
      RETURN public.phase42_err(
        'CONFLICT',
        'Thành viên đã bị gỡ (removed). Dùng quy trình restore riêng.'
      );
    END IF;

    SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      INTO v_display_name
    FROM public.profiles p
    WHERE p.id = p_target_user_id;

    v_athlete_id := public.wave5_ensure_athlete_for_club_member(
      p_target_user_id,
      v_club.id,
      v_display_name
    );

    INSERT INTO public.club_members (
      tenant_id, club_id, user_id, athlete_id, membership_type, status, version
    )
    VALUES (
      v_club.tenant_id, v_club.id, p_target_user_id, v_athlete_id,
      v_membership_type, 'active', 1
    )
    RETURNING * INTO v_member;
  END IF;

  PERFORM public.phase42_write_audit(
    'club.member.add',
    'club_member',
    v_member.id::text,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', p_target_user_id,
      'member_id', v_member.id,
      'athlete_id', v_member.athlete_id,
      'reactivated', v_reactivated,
      'membership_type', v_member.membership_type
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_member.id,
      'club_id', v_club.id,
      'user_id', v_member.user_id,
      'athlete_id', v_member.athlete_id,
      'status', v_member.status,
      'membership_type', v_member.membership_type,
      'reactivated', v_reactivated
    ),
    'version', v_member.version
  );

  PERFORM public.phase42_idempotency_put(
    p_request_id,
    v_club.tenant_id,
    'club_add_member',
    v_member.id::text,
    v_resp
  );

  RETURN v_resp::json;
EXCEPTION
  WHEN unique_violation THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'ATHLETE_FACILITY_VENUE_REQUIRED%' THEN
      RETURN public.phase42_err(
        'ATHLETE_FACILITY_VENUE_REQUIRED',
        'CLB chưa đăng ký cụm sân hợp lệ. Không thể tạo hồ sơ VĐV mới khi thiếu cơ sở.'
      );
    END IF;
    RAISE;
END;
$$;

-- Mutation EXECUTE restore is 07D after VERIFY, not APPLY (fail-closed while quiesced).

CREATE OR REPLACE FUNCTION public.club_restore_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_expected_version integer default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_active public.club_members%rowtype;
  v_removed public.club_members%rowtype;
  v_member public.club_members%rowtype;
  v_from_version integer;
  v_athlete_id uuid;
  v_display_name text;
  v_resp jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN public.phase42_err('VALIDATION', 'Thiếu target user_id.');
  END IF;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_restore_member');
  IF v_cached IS NOT NULL THEN
    RETURN v_cached::json;
  END IF;

  SELECT * INTO v_club
  FROM public.clubs
  WHERE id = trim(coalesce(p_club_id, ''))
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  END IF;

  IF NOT (
    public.phase42_is_platform_super_admin()
    OR public.phase42_can_review_membership(v_club.id)
  ) THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền khôi phục thành viên.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy người dùng đích.');
  END IF;

  SELECT * INTO v_active
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'active'
  FOR UPDATE;
  IF FOUND THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  END IF;

  SELECT * INTO v_removed
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'removed'
  ORDER BY left_at DESC NULLS LAST, updated_at DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND v_removed.version IS DISTINCT FROM p_expected_version THEN
      RETURN public.phase42_err('VERSION_CONFLICT', 'Phiên bản thành viên đã thay đổi.');
    END IF;

    v_from_version := v_removed.version;

    SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      INTO v_display_name
    FROM public.profiles p
    WHERE p.id = p_target_user_id;

    v_athlete_id := coalesce(
      v_removed.athlete_id,
      public.wave5_ensure_athlete_for_club_member(
        p_target_user_id,
        v_club.id,
        v_display_name
      )
    );

    UPDATE public.club_members
    SET status = 'active',
        left_at = NULL,
        athlete_id = v_athlete_id,
        version = version + 1,
        updated_at = now()
    WHERE id = v_removed.id
    RETURNING * INTO v_member;

    PERFORM public.phase42_write_audit(
      'club.member.restore',
      'club_member',
      v_member.id::text,
      v_club.tenant_id,
      v_club.id,
      jsonb_build_object(
        'request_id', p_request_id,
        'target_user_id', p_target_user_id,
        'member_id', v_member.id,
        'from_version', v_from_version,
        'prior_status', 'removed',
        'target_status', 'active',
        'membership_type', v_member.membership_type
      )
    );

    v_resp := jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'id', v_member.id,
        'club_id', v_club.id,
        'user_id', v_member.user_id,
        'athlete_id', v_member.athlete_id,
        'status', v_member.status,
        'membership_type', v_member.membership_type,
        'restored', true,
        'from_version', v_from_version
      ),
      'version', v_member.version
    );

    PERFORM public.phase42_idempotency_put(
      p_request_id,
      v_club.tenant_id,
      'club_restore_member',
      v_member.id::text,
      v_resp
    );

    RETURN v_resp::json;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members
    WHERE club_id = v_club.id
      AND user_id = p_target_user_id
      AND status = 'left'
  ) THEN
    RETURN public.phase42_err(
      'CONFLICT',
      'Thành viên đang ở trạng thái left. Dùng club_add_member để tái kích hoạt.'
    );
  END IF;

  RETURN public.phase42_err(
    'NOT_FOUND',
    'Không có lịch sử removed. Dùng club_add_member để thêm thành viên mới.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'ATHLETE_FACILITY_VENUE_REQUIRED%' THEN
      RETURN public.phase42_err(
        'ATHLETE_FACILITY_VENUE_REQUIRED',
        'CLB chưa đăng ký cụm sân hợp lệ. Không thể tạo hồ sơ VĐV mới khi thiếu cơ sở.'
      );
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.club_review_membership_request(
  p_request_id uuid,
  p_membership_request_id uuid,
  p_decision text,
  p_review_note text default null,
  p_expected_version integer default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.club_membership_requests_v42%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_member_id uuid;
  v_athlete_id uuid;
  v_resp json;
  v_display_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  IF v_decision NOT IN ('approved', 'rejected') THEN
    RETURN public.phase42_err('VALIDATION', 'decision phải là approved hoặc rejected.');
  END IF;

  SELECT * INTO v_row
  FROM public.club_membership_requests_v42
  WHERE id = p_membership_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy yêu cầu.');
  END IF;

  IF NOT public.phase42_has_gov_role(v_row.club_id, ARRAY['club_owner','president','vice_president'])
     AND NOT public.phase42_is_platform_super_admin() THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền duyệt yêu cầu.');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN public.phase42_err('CONFLICT', 'Yêu cầu không còn ở trạng thái pending.');
  END IF;

  IF p_expected_version IS NOT NULL AND v_row.version IS DISTINCT FROM p_expected_version THEN
    RETURN public.phase42_err('VERSION_CONFLICT', 'Phiên bản yêu cầu đã thay đổi.');
  END IF;

  UPDATE public.club_membership_requests_v42
  SET status = v_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note,
      version = version + 1,
      updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  IF v_decision = 'approved' THEN
    SELECT id, athlete_id INTO v_member_id, v_athlete_id
    FROM public.club_members
    WHERE club_id = v_row.club_id
      AND user_id = v_row.user_id
      AND status = 'active';

    IF v_member_id IS NULL THEN
      SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), v_row.user_id::text)
        INTO v_display_name
      FROM public.profiles p
      WHERE p.id = v_row.user_id;

      v_athlete_id := public.wave5_ensure_athlete_for_club_member(
        v_row.user_id,
        v_row.club_id,
        v_display_name
      );

      INSERT INTO public.club_members (
        tenant_id, club_id, user_id, athlete_id, membership_type, status, version
      )
      VALUES (
        v_row.tenant_id, v_row.club_id, v_row.user_id, v_athlete_id, 'regular', 'active', 1
      )
      RETURNING id INTO v_member_id;
    ELSIF v_athlete_id IS NULL THEN
      SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), v_row.user_id::text)
        INTO v_display_name
      FROM public.profiles p
      WHERE p.id = v_row.user_id;

      v_athlete_id := public.wave5_ensure_athlete_for_club_member(
        v_row.user_id,
        v_row.club_id,
        v_display_name
      );

      UPDATE public.club_members
      SET athlete_id = v_athlete_id,
          updated_at = now(),
          version = version + 1
      WHERE id = v_member_id;
    END IF;
  END IF;

  PERFORM public.phase42_write_audit(
    'club.membership_request.review',
    'club_membership_request',
    v_row.id::text,
    v_row.tenant_id,
    v_row.club_id,
    jsonb_build_object(
      'decision', v_decision,
      'request_id', p_request_id,
      'member_id', v_member_id,
      'athlete_id', v_athlete_id
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_row.id,
      'club_id', v_row.club_id,
      'user_id', v_row.user_id,
      'status', v_decision,
      'member_id', v_member_id,
      'athlete_id', v_athlete_id
    ),
    'version', v_row.version
  );

  PERFORM public.phase42_idempotency_put(
    p_request_id,
    v_row.tenant_id,
    'club_review_membership_request',
    v_row.id::text,
    v_resp
  );

  RETURN v_resp::json;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'ATHLETE_FACILITY_VENUE_REQUIRED%' THEN
      RETURN public.phase42_err(
        'ATHLETE_FACILITY_VENUE_REQUIRED',
        'CLB chưa đăng ký cụm sân hợp lệ. Không thể tạo hồ sơ VĐV mới khi thiếu cơ sở.'
      );
    END IF;
    RAISE;
END;
$$;

-- =====================================================================
-- 4. Club RLS — canonical tenant entitlement. Do not globally retire helper.
-- =====================================================================
DROP POLICY IF EXISTS clubs_select ON public.clubs;
CREATE POLICY clubs_select ON public.clubs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.phase42_is_platform_super_admin()
      OR public.platform_is_canonical_tenant_entitled(tenant_id)
      OR public.phase42_active_club_member_id(id) IS NOT NULL
    )
  );

DROP POLICY IF EXISTS club_members_select ON public.club_members;
CREATE POLICY club_members_select ON public.club_members
  FOR SELECT TO authenticated
  USING (
    public.phase42_is_platform_super_admin()
    OR user_id = auth.uid()
    OR public.platform_is_canonical_tenant_entitled(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.club_members self
      WHERE self.club_id = club_members.club_id
        AND self.user_id = auth.uid()
        AND self.status = 'active'
    )
  );

DROP POLICY IF EXISTS club_gov_select ON public.club_governance_assignments;
CREATE POLICY club_gov_select ON public.club_governance_assignments
  FOR SELECT TO authenticated
  USING (
    public.phase42_is_platform_super_admin()
    OR public.platform_is_canonical_tenant_entitled(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_governance_assignments.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DO $wave5_apply_applied$
DECLARE
  v_updated int := 0;
BEGIN
  UPDATE public.wave5_club_cutover_batch
  SET state = 'APPLIED',
      apply_committed_at = clock_timestamp()
  WHERE batch_id = nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid
    AND state = 'APPLYING'
    AND cutover_kind = 'WAVE5_CLUB_TENANT';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: APPLYING → APPLIED failed';
  END IF;
END $wave5_apply_applied$;

COMMIT;
