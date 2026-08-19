-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- RESTORE_LEGACY_WRITES — Owner-elected only after Q1 success + APPLY abort
-- (or abandoned cutover). Replay EXACT captured EXECUTE grants.
-- Do NOT GRANT a generic authenticated/public permission set.

BEGIN;

DO $$
DECLARE
  v_batch uuid;
  r record;
  v_reg text;
  v_oid regprocedure;
  v_granted int := 0;
BEGIN
  SELECT s.batch_id INTO v_batch
  FROM public.wave5_cutover_rpc_privilege_snapshot s
  ORDER BY s.captured_at DESC
  LIMIT 1;

  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: no privilege snapshot — refusing generic GRANT';
  END IF;

  FOR r IN
    SELECT nspname, proname, identity_args, grantee_name, is_grantable
    FROM public.wave5_cutover_rpc_privilege_snapshot
    WHERE batch_id = v_batch
      AND privilege_type = 'EXECUTE'
  LOOP
    v_reg := format('%s.%s(%s)', r.nspname, r.proname, r.identity_args);
    v_oid := to_regprocedure(v_reg);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_ABORT: captured function missing %', v_reg;
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

  RAISE NOTICE 'WAVE5_RESTORE_LEGACY_WRITES_OK batch=% replayed_execute_grants=%', v_batch, v_granted;
END $$;

COMMIT;
