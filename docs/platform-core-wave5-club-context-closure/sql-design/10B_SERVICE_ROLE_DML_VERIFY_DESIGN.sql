-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- PHASE_Q0A_VERIFY (read-only)
-- Requires: SET wave5.cutover_batch_id = '<uuid from Q0A NOTICE>';
-- Verifies table-privilege snapshot exists for the batch and effective
-- service_role INSERT/UPDATE/DELETE/TRUNCATE are DENIED on the four Club tables.
-- Documents expected rolbypassrls unchanged observation (read-only; does not mutate).
--
-- SERVICE_ROLE_DIRECT_DML_GUARD_DESIGNED=YES
-- SERVICE_ROLE_BYPASSRLS_UNCHANGED=YES
-- SERVICE_ROLE_DIRECT_DML_IS_CLUB_DOMAIN_AUTHORITY=NO

DO $$
DECLARE
  v_batch uuid;
  v_state text;
  v_kind text;
  v_snap_n int := 0;
  v_bad int := 0;
  v_tbl text;
  v_priv text;
  v_denied int := 0;
  v_bypassrls boolean;
BEGIN
  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: wave5.cutover_batch_id is not a uuid';
  END;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: explicit cutover_batch_id required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: service_role role missing';
  END IF;

  SELECT b.state, b.cutover_kind
    INTO v_state, v_kind
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: batch % missing', v_batch;
  END IF;
  IF v_kind IS DISTINCT FROM 'WAVE5_CLUB_TENANT' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: batch % kind=% expected WAVE5_CLUB_TENANT',
      v_batch, v_kind;
  END IF;

  SELECT count(*) INTO v_snap_n
  FROM public.wave5_cutover_table_privilege_snapshot s
  WHERE s.batch_id = v_batch;

  -- Empty snapshot is valid when Q0A found no capturable service_role Club DML.
  -- When rows exist, they must be exactly the certified scope.
  SELECT count(*) INTO v_bad
  FROM public.wave5_cutover_table_privilege_snapshot s
  WHERE s.batch_id = v_batch
    AND (
      s.grantee_name IS DISTINCT FROM 'service_role'
      OR s.schema_name IS DISTINCT FROM 'public'
      OR s.table_name NOT IN (
        'clubs',
        'club_members',
        'club_governance_assignments',
        'club_membership_requests_v42'
      )
      OR s.privilege_type NOT IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: snapshot batch % has % out-of-scope rows',
      v_batch, v_bad;
  END IF;

  IF v_snap_n = 0 THEN
    RAISE NOTICE 'WAVE5_Q0A_VERIFY_EMPTY_SNAPSHOT batch=% (allowed when pre-Q0A service_role Club DML was absent)',
      v_batch;
  ELSE
    RAISE NOTICE 'WAVE5_Q0A_VERIFY_SNAPSHOT_ROWS=% batch=%', v_snap_n, v_batch;
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_tbl)) IS NULL THEN
      RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: required Club table missing public.%', v_tbl;
    END IF;
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']
    LOOP
      IF has_table_privilege('service_role', format('public.%I', v_tbl), v_priv) THEN
        RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: service_role still has % on public.% — Q0A guard not effective',
          v_priv, v_tbl;
      END IF;
      v_denied := v_denied + 1;
    END LOOP;
  END LOOP;

  IF v_denied <> 16 THEN
    RAISE EXCEPTION 'WAVE5_Q0A_VERIFY_ABORT: expected 16 DENIED checks (4 tables × 4 privs), got %',
      v_denied;
  END IF;

  SELECT r.rolbypassrls INTO v_bypassrls
  FROM pg_catalog.pg_roles r
  WHERE r.rolname = 'service_role';

  -- Observation only. Q0A must not change rolbypassrls.
  -- BYPASSRLS alone does not grant DML when privileges are DENIED.
  RAISE NOTICE 'WAVE5_Q0A_VERIFY_OK batch=% state=% SERVICE_ROLE_DIRECT_DML=DENIED SERVICE_ROLE_BYPASSRLS_OBSERVED=% SERVICE_ROLE_BYPASSRLS_UNCHANGED=YES (observation; not mutated by this verify)',
    v_batch, v_state, v_bypassrls;
END $$;
