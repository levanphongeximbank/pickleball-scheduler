-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- RESTORE_LEGACY_WRITES — PRE-APPLY abandonment/failure recovery only.
-- Allowed durable states: PREPARED, QUIESCED, DRAINED.
-- POST_APPLY_LEGACY_ACL_RESTORE=DENIED
-- APPLYING is transaction-local and is not restore authority.
-- If APPLY fails, its transaction rolls back to durable DRAINED.
-- If APPLY has COMMITTED (APPLIED/VERIFIED): do not replay legacy ACL.
-- Replay EXACT captured EXECUTE grants including service_role mutation
-- privileges if Q1 changed them.
-- Do NOT GRANT a generic authenticated/public/service_role permission set.
-- RESTORE_REQUIRES_EXPLICIT_BATCH_ID=YES
-- LATEST_SNAPSHOT_IMPLICIT_RESTORE=DENIED
-- RESTORE_FINAL_ACL_EQUALS_SNAPSHOT=YES
-- ACL_RESTORE_FUNCTION_IDENTITY_AUTHORITY=APPROVED_REGPROCEDURE_OID
-- identity_args in the snapshot is DISPLAY_IDENTITY_ARGUMENTS only.

BEGIN;

DO $$
DECLARE
  v_batch uuid;
  r record;
  v_oid regprocedure;
  v_granted int := 0;
  v_state text;
  v_kind text;
  v_snap_batches int := 0;
  v_updated int := 0;
BEGIN
  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.restore_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: wave5.restore_batch_id is not a uuid';
  END;

  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: missing batch — RESTORE_REQUIRES_EXPLICIT_BATCH_ID';
  END IF;

  SELECT b.state, b.cutover_kind
    INTO v_state, v_kind
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch
  FOR UPDATE;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: no privilege snapshot — refusing generic GRANT (missing batch %)',
      v_batch;
  END IF;
  IF v_kind IS DISTINCT FROM 'WAVE5_CLUB_TENANT' THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: batch % is another cutover kind=%', v_batch, v_kind;
  END IF;
  IF v_state IN ('APPLIED', 'VERIFIED') THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: POST_APPLY_LEGACY_ACL_RESTORE=DENIED state=% — KEEP_WRITES_QUIESCED APP_ROLLBACK_KEEP_CANONICAL_DB POST_APPLY_VERIFY_FAILURE_OWNER_DECISION_REQUIRED=YES',
      v_state;
  END IF;
  IF v_state IN ('RESTORED', 'ABORTED', 'APPLYING') THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: already-restored, aborted, or transaction-local APPLYING is not restore authority state=%',
      v_state;
  END IF;
  IF v_state NOT IN ('PREPARED', 'QUIESCED', 'DRAINED') THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: wrong state % for legacy restore', v_state;
  END IF;

  SELECT count(DISTINCT s.batch_id) INTO v_snap_batches
  FROM public.wave5_cutover_rpc_privilege_snapshot s
  WHERE s.batch_id = v_batch;
  IF v_snap_batches <> 1 THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: ambiguous snapshot for batch % snap_batches=%',
      v_batch, v_snap_batches;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.wave5_cutover_rpc_privilege_snapshot s
    WHERE s.batch_id = v_batch
      AND s.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: snapshot batch % had zero EXECUTE rows', v_batch;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.wave5_cutover_rpc_privilege_snapshot s
    WHERE s.batch_id = v_batch
      AND s.privilege_type = 'EXECUTE'
      AND (
        s.nspname IS DISTINCT FROM 'public'
        OR s.proname NOT IN (
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
      )
  ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: snapshot function is not on the approved mutation surface';
  END IF;

  FOR r IN
    SELECT
      s.nspname,
      s.proname,
      s.identity_args,
      s.grantee_name,
      s.is_grantable,
      a.sig AS approved_sig
    FROM public.wave5_cutover_rpc_privilege_snapshot s
    JOIN (
      VALUES
        ('club_create'::name, 'public.club_create(uuid,text,text,text,text,text)'::text),
        ('club_update', 'public.club_update(uuid,text,integer,text,text,text,text,text)'),
        ('club_assign_owner', 'public.club_assign_owner(uuid,text,uuid,integer)'),
        ('club_clear_owner', 'public.club_clear_owner(uuid,text,integer)'),
        ('club_transfer_president', 'public.club_transfer_president(uuid,text,uuid,integer)'),
        ('club_assign_vice_president', 'public.club_assign_vice_president(uuid,text,uuid,integer)'),
        ('club_clear_vice_president', 'public.club_clear_vice_president(uuid,text,integer,uuid)'),
        ('club_add_member', 'public.club_add_member(uuid,text,uuid,text,integer)'),
        ('club_remove_member', 'public.club_remove_member(uuid,text,uuid,integer)'),
        ('club_restore_member', 'public.club_restore_member(uuid,text,uuid,integer)'),
        ('club_leave_membership', 'public.club_leave_membership(uuid,text)'),
        ('club_submit_membership_request', 'public.club_submit_membership_request(uuid,text,text)'),
        ('club_cancel_membership_request', 'public.club_cancel_membership_request(uuid,uuid,integer)'),
        ('club_review_membership_request', 'public.club_review_membership_request(uuid,uuid,text,text,integer)'),
        ('club_leave_my_membership', 'public.club_leave_my_membership()')
    ) AS a(proname, sig) ON a.proname = s.proname
    WHERE s.batch_id = v_batch
      AND s.privilege_type = 'EXECUTE'
  LOOP
    v_oid := to_regprocedure(r.approved_sig);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: captured function missing %', r.approved_sig;
    END IF;

    IF r.grantee_name = 'PUBLIC' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC%s',
        v_oid,
        CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I%s',
        v_oid,
        r.grantee_name,
        CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    END IF;
    v_granted := v_granted + 1;
  END LOOP;

  IF v_granted < 1 THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: snapshot batch % had zero EXECUTE rows', v_batch;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.wave5_cutover_rpc_privilege_snapshot s0
    JOIN (
      VALUES
        ('club_create'::name, 'public.club_create(uuid,text,text,text,text,text)'::text),
        ('club_update', 'public.club_update(uuid,text,integer,text,text,text,text,text)'),
        ('club_assign_owner', 'public.club_assign_owner(uuid,text,uuid,integer)'),
        ('club_clear_owner', 'public.club_clear_owner(uuid,text,integer)'),
        ('club_transfer_president', 'public.club_transfer_president(uuid,text,uuid,integer)'),
        ('club_assign_vice_president', 'public.club_assign_vice_president(uuid,text,uuid,integer)'),
        ('club_clear_vice_president', 'public.club_clear_vice_president(uuid,text,integer,uuid)'),
        ('club_add_member', 'public.club_add_member(uuid,text,uuid,text,integer)'),
        ('club_remove_member', 'public.club_remove_member(uuid,text,uuid,integer)'),
        ('club_restore_member', 'public.club_restore_member(uuid,text,uuid,integer)'),
        ('club_leave_membership', 'public.club_leave_membership(uuid,text)'),
        ('club_submit_membership_request', 'public.club_submit_membership_request(uuid,text,text)'),
        ('club_cancel_membership_request', 'public.club_cancel_membership_request(uuid,uuid,integer)'),
        ('club_review_membership_request', 'public.club_review_membership_request(uuid,uuid,text,text,integer)'),
        ('club_leave_my_membership', 'public.club_leave_my_membership()')
    ) AS approved(proname, sig) ON approved.proname = s0.proname
    JOIN pg_catalog.pg_proc p ON p.oid = to_regprocedure(approved.sig)
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace AND n.nspname = s0.nspname
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
    WHERE s0.batch_id = v_batch
      AND acl.privilege_type = 'EXECUTE'
      AND (acl.grantee = 0 OR r.rolname IN ('anon', 'authenticated', 'service_role'))
      AND NOT EXISTS (
        SELECT 1
        FROM public.wave5_cutover_rpc_privilege_snapshot s
        WHERE s.batch_id = v_batch
          AND s.nspname = n.nspname
          AND s.proname = p.proname
          AND s.privilege_type = 'EXECUTE'
          AND s.grantee_name = CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END
          AND s.is_grantable = acl.is_grantable
      )
  ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: RESTORE_FINAL_ACL_EQUALS_SNAPSHOT=NO unexpected caller-role grant — ROLLBACK KEEP WRITES QUIESCED OWNER REVIEW REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.wave5_cutover_rpc_privilege_snapshot s
    JOIN (
      VALUES
        ('club_create'::name, 'public.club_create(uuid,text,text,text,text,text)'::text),
        ('club_update', 'public.club_update(uuid,text,integer,text,text,text,text,text)'),
        ('club_assign_owner', 'public.club_assign_owner(uuid,text,uuid,integer)'),
        ('club_clear_owner', 'public.club_clear_owner(uuid,text,integer)'),
        ('club_transfer_president', 'public.club_transfer_president(uuid,text,uuid,integer)'),
        ('club_assign_vice_president', 'public.club_assign_vice_president(uuid,text,uuid,integer)'),
        ('club_clear_vice_president', 'public.club_clear_vice_president(uuid,text,integer,uuid)'),
        ('club_add_member', 'public.club_add_member(uuid,text,uuid,text,integer)'),
        ('club_remove_member', 'public.club_remove_member(uuid,text,uuid,integer)'),
        ('club_restore_member', 'public.club_restore_member(uuid,text,uuid,integer)'),
        ('club_leave_membership', 'public.club_leave_membership(uuid,text)'),
        ('club_submit_membership_request', 'public.club_submit_membership_request(uuid,text,text)'),
        ('club_cancel_membership_request', 'public.club_cancel_membership_request(uuid,uuid,integer)'),
        ('club_review_membership_request', 'public.club_review_membership_request(uuid,uuid,text,text,integer)'),
        ('club_leave_my_membership', 'public.club_leave_my_membership()')
    ) AS approved(proname, sig) ON approved.proname = s.proname
    WHERE s.batch_id = v_batch
      AND s.privilege_type = 'EXECUTE'
      AND s.grantee_name IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
        WHERE p.oid = to_regprocedure(approved.sig)
          AND n.nspname = s.nspname
          AND acl.privilege_type = 'EXECUTE'
          AND acl.is_grantable = s.is_grantable
          AND CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END = s.grantee_name
      )
  ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: RESTORE_FINAL_ACL_EQUALS_SNAPSHOT=NO captured caller-role grant missing — ROLLBACK KEEP WRITES QUIESCED OWNER REVIEW REQUIRED';
  END IF;

  UPDATE public.wave5_club_cutover_batch
  SET state = 'ABORTED',
      aborted_at = clock_timestamp(),
      writes_restored_at = clock_timestamp()
  WHERE batch_id = v_batch
    AND state IN ('PREPARED', 'QUIESCED', 'DRAINED');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: state transition to ABORTED failed for %', v_batch;
  END IF;

  RAISE NOTICE 'WAVE5_RESTORE_LEGACY_WRITES_OK batch=% replayed_execute_grants=% state=ABORTED POST_APPLY_LEGACY_ACL_RESTORE=DENIED',
    v_batch, v_granted;
END $$;

COMMIT;
