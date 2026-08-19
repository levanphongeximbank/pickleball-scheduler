-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- READ-ONLY drain proof after committed Q1. Do not APPLY until PASS.
-- Do not assume query text names the RPC: PostgREST may show
-- SELECT club_create(...) / prepared statements / truncated query.
-- Strongest practical checks: conflicting relation locks + remaining EXECUTE.

DO $$
DECLARE
  v_auth_exec int := 0;
  v_write_locks int := 0;
  v_active_club_waiters int := 0;
BEGIN
  SELECT count(*) INTO v_auth_exec
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
      ('public.club_review_membership_request(uuid,uuid,text,text,integer)')
  ) s(sig)
  WHERE to_regprocedure(s.sig) IS NOT NULL
    AND has_function_privilege('authenticated', s.sig, 'EXECUTE');

  IF v_auth_exec > 0 THEN
    RAISE EXCEPTION 'WAVE5_DRAIN_FAIL: CLUB_MUTATION_NEW_CALLS_QUIESCED=NO authenticated_execute_remaining=%',
      v_auth_exec;
  END IF;

  -- In-flight writers hold RowExclusiveLock or stronger on Club-owned tables.
  -- AccessShareLock from SELECT is allowed. Ignore this backend.
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
    RAISE EXCEPTION 'WAVE5_DRAIN_FAIL: CLUB_MUTATION_IN_FLIGHT_DRAINED=NO club_write_locks=% — APPLY=ABORT',
      v_write_locks;
  END IF;

  -- Backends waiting on those relations (lock queue), independent of query text.
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
    RAISE EXCEPTION 'WAVE5_DRAIN_FAIL: lock waiters on Club tables=% — APPLY=ABORT',
      v_active_club_waiters;
  END IF;

  RAISE NOTICE 'WAVE5_DRAIN_PASS CLUB_MUTATION_NEW_CALLS_QUIESCED=YES CLUB_MUTATION_IN_FLIGHT_DRAINED=YES';
END $$;

-- Operator evidence (repeat once after >=1s). Query text is supporting only:
SELECT a.pid, a.usename, a.application_name, a.state, a.wait_event_type, a.wait_event,
       left(a.query, 120) AS query_prefix
FROM pg_catalog.pg_stat_activity a
WHERE a.pid IS DISTINCT FROM pg_backend_pid()
  AND a.datname = current_database()
  AND a.state IS DISTINCT FROM 'idle'
ORDER BY a.pid;
