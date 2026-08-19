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
-- Does NOT revoke:
--   - read RPCs
--   - phase42 / Wave 5 internal helpers used by migration ownership
--   - service_role EXECUTE (left as captured; not the PostgREST user path)
-- MUTATION_RPC_PRE_PRIVILEGES_CAPTURED=YES

BEGIN;

CREATE TABLE IF NOT EXISTS public.wave5_cutover_rpc_privilege_snapshot (
  batch_id uuid NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  nspname name NOT NULL,
  proname name NOT NULL,
  identity_args text NOT NULL,
  grantee_name text NOT NULL,
  privilege_type text NOT NULL,
  is_grantable boolean NOT NULL,
  PRIMARY KEY (batch_id, nspname, proname, identity_args, grantee_name, privilege_type)
);

COMMENT ON TABLE public.wave5_cutover_rpc_privilege_snapshot IS
  'WAVE5_SQL_DESIGN_ONLY capture of exact function EXECUTE ACLs before Q1 REVOKE. Restore via 07C only.';

DO $$
DECLARE
  v_batch uuid := gen_random_uuid();
  v_sig text;
  v_oid regprocedure;
  v_revoked int := 0;
BEGIN
  RAISE NOTICE 'WAVE5_Q1_CAPTURE_BATCH=%', v_batch;

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
    AND acl.privilege_type = 'EXECUTE';

  IF NOT EXISTS (
    SELECT 1
    FROM public.wave5_cutover_rpc_privilege_snapshot s
    WHERE s.batch_id = v_batch
  ) THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: privilege snapshot empty — refusing REVOKE without capture';
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
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
  ]
  LOOP
    v_oid := to_regprocedure(v_sig);
    IF v_oid IS NULL THEN
      RAISE NOTICE 'WAVE5_Q1_SKIP_MISSING %', v_sig;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_oid);
    v_revoked := v_revoked + 1;
  END LOOP;

  IF v_revoked < 14 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: expected to REVOKE at least 14 canonical mutation signatures, revoked=%',
      v_revoked;
  END IF;

  IF has_function_privilege(
       'authenticated',
       'public.club_create(uuid,text,text,text,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: authenticated EXECUTE still present on club_create after REVOKE';
  END IF;

  RAISE NOTICE 'WAVE5_Q1_QUIESCE_READY revoked_present_signatures=% batch=%', v_revoked, v_batch;
END $$;

COMMIT;
