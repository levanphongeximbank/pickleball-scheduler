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
  v_active_other int := 0;
  v_updated int := 0;
  v_sig text;
  v_oid regprocedure;
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
      RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: service_role still has EXECUTE on mutation entrypoint %',
        v_sig;
    END IF;
  END LOOP;

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
    AND coalesce(a.backend_type, '') NOT IN (
      'autovacuum worker',
      'autovacuum launcher',
      'background writer',
      'checkpointer',
      'walwriter',
      'walreceiver'
    )
    AND a.state IS DISTINCT FROM 'idle'
    AND a.xact_start IS NOT NULL
    AND a.xact_start <= v_visible
    AND (
      a.usename IN ('authenticated', 'anon', 'authenticator', 'service_role')
      OR lower(coalesce(a.application_name, '')) LIKE '%postgrest%'
    );
  IF v_pre_q1 > 0 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: PRE_QUIESCE_INFLIGHT_TRANSACTION_BARRIER pre_quiesce_api_xacts=%',
      v_pre_q1;
  END IF;

  SELECT count(*) INTO v_active_other
  FROM pg_catalog.pg_stat_activity a
  WHERE a.pid IS DISTINCT FROM pg_backend_pid()
    AND a.datname = current_database()
    AND coalesce(a.backend_type, '') NOT IN (
      'autovacuum worker',
      'autovacuum launcher',
      'background writer',
      'checkpointer',
      'walwriter',
      'walreceiver'
    )
    AND a.state IN ('idle in transaction', 'idle in transaction (aborted)')
    AND a.xact_start IS NOT NULL
    AND a.xact_start <= v_visible
    AND a.usename IS NULL;
  IF v_active_other > 0 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_MARK_ABORT: ambiguous pre-quiesce sessions=%', v_active_other;
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
