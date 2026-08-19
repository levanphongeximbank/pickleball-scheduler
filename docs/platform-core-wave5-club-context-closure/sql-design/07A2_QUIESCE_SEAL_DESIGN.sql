-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- PHASE_Q1B_POST_COMMIT_SEAL
-- Run AFTER 07A COMMIT with the same explicit wave5.cutover_batch_id.
-- Q1_REVOKE_COMMIT_PRECEDES_QUIESCED_SEAL=YES
-- QUIESCE_VISIBLE_AT_IS_POST_Q1_COMMIT=YES
--
-- Verifies the Q1A PREPARED batch exists, mutation privileges remain
-- quiesced, and exactly one active batch. Then PREPARED → QUIESCED and
-- sets quiesce_visible_at = clock_timestamp() in THIS post-commit transaction.
--
-- Do not use q1_committed_at as drain authority.

BEGIN;

DO $$
DECLARE
  v_batch uuid;
  v_state text;
  v_visible timestamptz;
  v_updated int := 0;
  v_sig text;
  v_oid regprocedure;
  v_public_exec int := 0;
  v_anon_exec int := 0;
  v_auth_exec int := 0;
  v_service_exec int := 0;
BEGIN
  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: wave5.cutover_batch_id is not a uuid';
  END;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: explicit cutover_batch_id required';
  END IF;

  SELECT b.state, b.quiesce_visible_at
    INTO v_state, v_visible
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch
    AND b.cutover_kind = 'WAVE5_CLUB_TENANT'
  FOR UPDATE;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: Q1A batch % missing', v_batch;
  END IF;
  IF v_state IS DISTINCT FROM 'PREPARED' THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: invalid transition % → QUIESCED — Q1A PREPARED required',
      v_state;
  END IF;
  IF v_visible IS NOT NULL THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: quiesce_visible_at already set — seal is post-Q1-commit once';
  END IF;

  IF (
    SELECT count(*)
    FROM public.wave5_club_cutover_batch b
    WHERE b.cutover_kind = 'WAVE5_CLUB_TENANT'
      AND b.state NOT IN ('RESTORED', 'ABORTED')
  ) <> 1 THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: ONE_ACTIVE_CUTOVER_BATCH violated';
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
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
       AND has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      v_service_exec := v_service_exec + 1;
    END IF;
  END LOOP;

  IF v_public_exec <> 0 OR v_anon_exec <> 0 OR v_auth_exec <> 0 OR v_service_exec <> 0 THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: ALL_MUTATION_CALLER_ROLES_QUIESCED=NO PUBLIC=% ANON=% AUTHENTICATED=% SERVICE_ROLE=%',
      v_public_exec, v_anon_exec, v_auth_exec, v_service_exec;
  END IF;

  UPDATE public.wave5_club_cutover_batch
  SET state = 'QUIESCED',
      quiesce_visible_at = clock_timestamp()
  WHERE batch_id = v_batch
    AND state = 'PREPARED'
    AND quiesce_visible_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_Q1B_ABORT: PREPARED → QUIESCED seal failed for batch %', v_batch;
  END IF;

  RAISE NOTICE 'WAVE5_Q1B_SEALED batch=% state=QUIESCED QUIESCE_VISIBLE_AT_IS_POST_Q1_COMMIT=YES',
    v_batch;
END $$;

COMMIT;
