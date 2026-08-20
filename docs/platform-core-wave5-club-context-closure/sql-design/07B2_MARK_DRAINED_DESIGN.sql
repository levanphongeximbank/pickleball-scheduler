-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Durable QUIESCED → DRAINED. Rechecks critical drain conditions in THIS
-- transaction before setting state. Operator cannot mark DRAINED without
-- DB-side recheck. Does not kill sessions.
-- APPLY_REQUIRES_DURABLE_DRAIN_STATE=YES
-- DRAINED_UNKNOWN_OVERLOAD_GATE=ABORT
-- DRAINED_UNKNOWN_OVERLOAD_AUTHORITY=OID
-- PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER=YES
-- AMBIGUOUS_NAMED_DB_SESSION=FAIL_CLOSED
-- CANONICAL_MUTATION_SURFACE_REF=09_CANONICAL_MUTATION_SURFACE.sql

BEGIN;

DO $$
DECLARE
  v_batch uuid;
  v_visible timestamptz;
  v_state text;
  v_auth_exec int := 0;
  v_public_exec int := 0;
  v_anon_exec int := 0;
  v_write_locks int := 0;
  v_active_club_waiters int := 0;
  v_pre_q1 int := 0;
  v_updated int := 0;
  v_sig text;
  v_oid regprocedure;
  v_unknown int := 0;
  v_canonical_present int := 0;
BEGIN
  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: wave5.cutover_batch_id is not a uuid';
  END;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: explicit cutover_batch_id required';
  END IF;

  SELECT b.state, b.quiesce_visible_at
    INTO v_state, v_visible
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch
    AND b.cutover_kind = 'WAVE5_CLUB_TENANT'
  FOR UPDATE;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: batch % missing', v_batch;
  END IF;
  IF v_state IS DISTINCT FROM 'QUIESCED' THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: invalid transition % → DRAINED', v_state;
  END IF;
  IF v_visible IS NULL THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: quiesce_visible_at missing — pre-commit q1 timestamp cannot authorize drain';
  END IF;

  IF (
    SELECT count(*)
    FROM public.wave5_club_cutover_batch b
    WHERE b.cutover_kind = 'WAVE5_CLUB_TENANT'
      AND b.state NOT IN ('RESTORED', 'ABORTED')
  ) <> 1 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: ONE_ACTIVE_CUTOVER_BATCH violated';
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
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: DRAINED_UNKNOWN_OVERLOAD_GATE=ABORT UNKNOWN_MUTATION_RPC_OVERLOAD count=%',
      v_unknown;
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
    -- WAVE5_QUIESCE_15_ARRAY_BEGIN
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
    -- WAVE5_QUIESCE_15_ARRAY_END
  ]
  LOOP
    v_oid := to_regprocedure(v_sig);
    IF v_oid IS NULL THEN
      IF v_sig IS DISTINCT FROM 'public.club_leave_my_membership()' THEN
        RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: canonical mutation RPC missing %', v_sig;
      END IF;
      CONTINUE;
    END IF;
    IF v_sig IS DISTINCT FROM 'public.club_leave_my_membership()' THEN
      v_canonical_present := v_canonical_present + 1;
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
      RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: service_role still has EXECUTE on mutation entrypoint %',
        v_sig;
    END IF;
  END LOOP;

  IF v_canonical_present <> 14 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: CANONICAL_MUTATION_RPC_COUNT expected 14, present=%',
      v_canonical_present;
  END IF;
  IF v_public_exec > 0 OR v_anon_exec > 0 OR v_auth_exec > 0 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: mutation EXECUTE still present public=% anon=% authenticated=%',
      v_public_exec, v_anon_exec, v_auth_exec;
  END IF;

  SELECT count(*) INTO v_write_locks
  FROM pg_catalog.pg_locks l
  JOIN pg_catalog.pg_class c ON c.oid = l.relation
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE l.locktype = 'relation'
    AND n.nspname = 'public'
    AND c.relname IN (
      'clubs',
      'club_members',
      'club_governance_assignments',
      'club_membership_requests_v42'
    )
    AND l.pid IS DISTINCT FROM pg_backend_pid()
    AND l.mode IN (
      'RowExclusiveLock',
      'ShareUpdateExclusiveLock',
      'ShareRowExclusiveLock',
      'ExclusiveLock',
      'AccessExclusiveLock'
    );
  IF v_write_locks > 0 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: club_write_locks=%', v_write_locks;
  END IF;

  SELECT count(*) INTO v_active_club_waiters
  FROM pg_catalog.pg_stat_activity a
  JOIN pg_catalog.pg_locks l ON l.pid = a.pid
  JOIN pg_catalog.pg_class c ON c.oid = l.relation
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE a.pid IS DISTINCT FROM pg_backend_pid()
    AND a.state IS DISTINCT FROM 'idle'
    AND n.nspname = 'public'
    AND c.relname IN (
      'clubs',
      'club_members',
      'club_governance_assignments',
      'club_membership_requests_v42'
    )
    AND l.granted = false;
  IF v_active_club_waiters > 0 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: lock waiters=%', v_active_club_waiters;
  END IF;

  SELECT count(*) INTO v_pre_q1
  FROM pg_catalog.pg_stat_activity a
  WHERE a.pid IS DISTINCT FROM pg_backend_pid()
    AND a.datname = current_database()
    AND a.xact_start IS NOT NULL
    AND a.xact_start <= v_visible
    AND coalesce(a.backend_type, '') NOT IN (
      'autovacuum worker',
      'autovacuum launcher',
      'background writer',
      'checkpointer',
      'walwriter',
      'walreceiver',
      'archiver',
      'logger',
      'stats collector',
      'logical replication launcher'
    );
  IF v_pre_q1 > 0 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER=YES AMBIGUOUS_NAMED_DB_SESSION=FAIL_CLOSED PRE_QUIESCE_INFLIGHT_TRANSACTION_BARRIER pre_quiesce_xacts=%',
      v_pre_q1;
  END IF;

  UPDATE public.wave5_club_cutover_batch
  SET state = 'DRAINED',
      drained_at = clock_timestamp()
  WHERE batch_id = v_batch
    AND state = 'QUIESCED'
    AND quiesce_visible_at IS NOT NULL
    AND clock_timestamp() > quiesce_visible_at;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: DRAINED transition failed for batch %', v_batch;
  END IF;

  RAISE NOTICE 'WAVE5_DRAIN_MARKED batch=% state=DRAINED', v_batch;
END $$;

COMMIT;
