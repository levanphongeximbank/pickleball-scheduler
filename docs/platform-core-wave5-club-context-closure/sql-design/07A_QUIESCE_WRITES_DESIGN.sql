-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
-- RLS_EXECUTED=NO
--
-- PHASE_Q1_COMMITTED_WRITE_QUIESCE
-- Capture exact EXECUTE ACLs, then REVOKE public Club mutation entrypoints
-- from public / anon / authenticated, then COMMIT so new client sessions
-- observe the quiesce. Do not REVOKE inside 02_APPLY_DESIGN.sql: that REVOKE
-- is not visible to other sessions until APPLY commits.
--
-- CANONICAL_MUTATION_RPC_COUNT=14
-- LEGACY_COMPAT_MUTATION_RPC_COUNT=1
-- TOTAL_QUIESCE_TARGET_COUNT=15
-- ALL_CANONICAL_MUTATION_SIGNATURES_PRESENT_BEFORE_Q1=YES
-- UNKNOWN_MUTATION_RPC_OVERLOAD=ABORT
-- MUTATION_RPC_OVERLOAD_INVENTORY_COMPLETE=YES
-- PUBLIC_MUTATION_EXECUTE_AFTER_Q1=0
-- ANON_MUTATION_EXECUTE_AFTER_Q1=0
-- AUTHENTICATED_MUTATION_EXECUTE_AFTER_Q1=0
-- ONE_ACTIVE_CUTOVER_BATCH=YES
-- CUTOVER_STATE_MACHINE=YES
-- CUTOVER_METADATA_PUBLIC_ACCESS=DENIED
-- CUTOVER_METADATA_AUTHENTICATED_ACCESS=DENIED
-- CUTOVER_METADATA_ANON_ACCESS=DENIED
--
-- Does NOT revoke:
--   - read RPCs
--   - phase42 / Wave 5 internal helpers used by migration ownership
--   - service_role EXECUTE (left as captured; not the PostgREST user path)
-- MUTATION_RPC_PRE_PRIVILEGES_CAPTURED=YES
--
-- Legacy club_leave_my_membership():
--   CANONICAL_COMMAND_SURFACE=NO
--   QUIESCE_REQUIRED=YES if present
--   POST_CANONICAL_RESTORE=NO
--   A legacy alias must not compensate for a missing canonical RPC.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wave5_club_cutover_batch (
  batch_id uuid PRIMARY KEY,
  cutover_kind text NOT NULL DEFAULT 'WAVE5_CLUB_TENANT',
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  q1_committed_at timestamptz,
  drained_at timestamptz,
  apply_started_at timestamptz,
  apply_committed_at timestamptz,
  verified_at timestamptz,
  writes_restored_at timestamptz,
  aborted_at timestamptz,
  CONSTRAINT wave5_club_cutover_batch_kind_chk
    CHECK (cutover_kind = 'WAVE5_CLUB_TENANT'),
  CONSTRAINT wave5_club_cutover_batch_state_chk
    CHECK (state IN (
      'PREPARED',
      'QUIESCED',
      'DRAINED',
      'APPLYING',
      'APPLIED',
      'VERIFIED',
      'RESTORED',
      'ABORTED'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS wave5_club_cutover_batch_one_active
  ON public.wave5_club_cutover_batch (cutover_kind)
  WHERE state NOT IN ('RESTORED', 'ABORTED');

CREATE TABLE IF NOT EXISTS public.wave5_cutover_rpc_privilege_snapshot (
  batch_id uuid NOT NULL REFERENCES public.wave5_club_cutover_batch (batch_id),
  captured_at timestamptz NOT NULL DEFAULT now(),
  nspname name NOT NULL,
  proname name NOT NULL,
  identity_args text NOT NULL,
  grantee_name text NOT NULL,
  privilege_type text NOT NULL,
  is_grantable boolean NOT NULL,
  PRIMARY KEY (batch_id, nspname, proname, identity_args, grantee_name, privilege_type)
);

COMMENT ON TABLE public.wave5_club_cutover_batch IS
  'WAVE5_SQL_DESIGN_ONLY cutover control plane. Not an application table.';
COMMENT ON TABLE public.wave5_cutover_rpc_privilege_snapshot IS
  'WAVE5_SQL_DESIGN_ONLY capture of exact function EXECUTE ACLs before Q1 REVOKE. Restore via 07C with explicit batch_id only.';

REVOKE ALL ON TABLE public.wave5_club_cutover_batch FROM PUBLIC;
REVOKE ALL ON TABLE public.wave5_club_cutover_batch FROM anon, authenticated;
REVOKE ALL ON TABLE public.wave5_cutover_rpc_privilege_snapshot FROM PUBLIC;
REVOKE ALL ON TABLE public.wave5_cutover_rpc_privilege_snapshot FROM anon, authenticated;
ALTER TABLE public.wave5_club_cutover_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave5_cutover_rpc_privilege_snapshot ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_batch uuid := gen_random_uuid();
  v_sig text;
  v_oid regprocedure;
  v_is_canonical boolean;
  v_canonical_present int := 0;
  v_legacy_present int := 0;
  v_revoked int := 0;
  v_public_exec int := 0;
  v_anon_exec int := 0;
  v_auth_exec int := 0;
  v_unknown int := 0;
  r record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.wave5_club_cutover_batch b
    WHERE b.cutover_kind = 'WAVE5_CLUB_TENANT'
      AND b.state NOT IN ('RESTORED', 'ABORTED')
  ) THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: ONE_ACTIVE_CUTOVER_BATCH violated — active Wave5 Club batch already exists';
  END IF;

  FOR r IN
    SELECT * FROM (
      VALUES
        ('public.club_create(uuid,text,text,text,text,text)'::text, true),
        ('public.club_update(uuid,text,integer,text,text,text,text,text)', true),
        ('public.club_assign_owner(uuid,text,uuid,integer)', true),
        ('public.club_clear_owner(uuid,text,integer)', true),
        ('public.club_transfer_president(uuid,text,uuid,integer)', true),
        ('public.club_assign_vice_president(uuid,text,uuid,integer)', true),
        ('public.club_clear_vice_president(uuid,text,integer,uuid)', true),
        ('public.club_add_member(uuid,text,uuid,text,integer)', true),
        ('public.club_remove_member(uuid,text,uuid,integer)', true),
        ('public.club_restore_member(uuid,text,uuid,integer)', true),
        ('public.club_leave_membership(uuid,text)', true),
        ('public.club_submit_membership_request(uuid,text,text)', true),
        ('public.club_cancel_membership_request(uuid,uuid,integer)', true),
        ('public.club_review_membership_request(uuid,uuid,text,text,integer)', true),
        ('public.club_leave_my_membership()', false)
    ) AS t(sig text, is_canonical boolean)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF r.is_canonical THEN
      IF v_oid IS NULL THEN
        RAISE EXCEPTION 'WAVE5_Q1_ABORT: ALL_CANONICAL_MUTATION_SIGNATURES_PRESENT_BEFORE_Q1=NO missing %',
          r.sig;
      END IF;
      v_canonical_present := v_canonical_present + 1;
    ELSIF v_oid IS NOT NULL THEN
      v_legacy_present := v_legacy_present + 1;
    END IF;
  END LOOP;

  IF v_canonical_present <> 14 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CANONICAL_MUTATION_RPC_COUNT expected 14, present=% — legacy alias cannot satisfy canonical required count',
      v_canonical_present;
  END IF;

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
    AND format('%s.%s(%s)', n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid))
      NOT IN (
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
        'public.club_review_membership_request(uuid,uuid,text,text,integer)',
        'public.club_leave_my_membership()'
      );

  IF v_unknown > 0 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: UNKNOWN_MUTATION_RPC_OVERLOAD count=% MUTATION_RPC_OVERLOAD_INVENTORY_COMPLETE=NO',
      v_unknown;
  END IF;

  INSERT INTO public.wave5_club_cutover_batch (
    batch_id, cutover_kind, state, created_at, q1_committed_at
  ) VALUES (
    v_batch, 'WAVE5_CLUB_TENANT', 'QUIESCED', now(), clock_timestamp()
  );

  RAISE NOTICE 'WAVE5_Q1_CAPTURE_BATCH=% CANONICAL_MUTATION_RPC_COUNT=14 LEGACY_COMPAT_MUTATION_RPC_COUNT=% TOTAL_QUIESCE_TARGET_COUNT=15',
    v_batch, v_legacy_present;

  INSERT INTO public.wave5_cutover_rpc_privilege_snapshot (
    batch_id, nspname, proname, identity_args, grantee_name, privilege_type, is_grantable
  )
  SELECT
    v_batch,
    n.nspname,
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END,
    acl.privilege_type,
    acl.is_grantable
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
  LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND format('%s.%s(%s)', n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid))
      IN (
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
        'public.club_review_membership_request(uuid,uuid,text,text,integer)',
        'public.club_leave_my_membership()'
      )
    AND acl.privilege_type = 'EXECUTE';

  IF NOT EXISTS (
    SELECT 1
    FROM public.wave5_cutover_rpc_privilege_snapshot s
    WHERE s.batch_id = v_batch
  ) THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: privilege snapshot empty — refusing REVOKE without capture';
  END IF;

  FOR r IN
    SELECT * FROM (
      VALUES
        ('public.club_create(uuid,text,text,text,text,text)'::text, true),
        ('public.club_update(uuid,text,integer,text,text,text,text,text)', true),
        ('public.club_assign_owner(uuid,text,uuid,integer)', true),
        ('public.club_clear_owner(uuid,text,integer)', true),
        ('public.club_transfer_president(uuid,text,uuid,integer)', true),
        ('public.club_assign_vice_president(uuid,text,uuid,integer)', true),
        ('public.club_clear_vice_president(uuid,text,integer,uuid)', true),
        ('public.club_add_member(uuid,text,uuid,text,integer)', true),
        ('public.club_remove_member(uuid,text,uuid,integer)', true),
        ('public.club_restore_member(uuid,text,uuid,integer)', true),
        ('public.club_leave_membership(uuid,text)', true),
        ('public.club_submit_membership_request(uuid,text,text)', true),
        ('public.club_cancel_membership_request(uuid,uuid,integer)', true),
        ('public.club_review_membership_request(uuid,uuid,text,text,integer)', true),
        ('public.club_leave_my_membership()', false)
    ) AS t(sig text, is_canonical boolean)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF v_oid IS NULL THEN
      IF r.is_canonical THEN
        RAISE EXCEPTION 'WAVE5_Q1_ABORT: canonical signature missing before REVOKE %', r.sig;
      END IF;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_oid);
    v_revoked := v_revoked + 1;
  END LOOP;

  IF v_revoked < 14 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: expected to REVOKE 14 canonical mutation signatures, revoked=%',
      v_revoked;
  END IF;

  FOR r IN
    SELECT * FROM (
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
    ) AS t(sig text)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF v_oid IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE p.oid = v_oid
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee = 0
    ) THEN
      v_public_exec := v_public_exec + 1;
    END IF;
    IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
      v_anon_exec := v_anon_exec + 1;
    END IF;
    IF has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      v_auth_exec := v_auth_exec + 1;
    END IF;
  END LOOP;

  IF v_public_exec <> 0 OR v_anon_exec <> 0 OR v_auth_exec <> 0 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: PUBLIC_MUTATION_EXECUTE_AFTER_Q1=% ANON_MUTATION_EXECUTE_AFTER_Q1=% AUTHENTICATED_MUTATION_EXECUTE_AFTER_Q1=%',
      v_public_exec, v_anon_exec, v_auth_exec;
  END IF;

  RAISE NOTICE 'WAVE5_Q1_QUIESCE_READY revoked_present_signatures=% batch=% PUBLIC_MUTATION_EXECUTE_AFTER_Q1=0 ANON_MUTATION_EXECUTE_AFTER_Q1=0 AUTHENTICATED_MUTATION_EXECUTE_AFTER_Q1=0',
    v_revoked, v_batch;
END $$;

COMMIT;
