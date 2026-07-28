-- PLATFORM-HARD-CUTOVER-01 reseed step 13 — Customer first-use
-- NOT EXECUTED. Staging-ahead families; duplicate-detect by seed_key.

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_key text;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'RESEED_13_CUSTOMER: tenant required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::customer::c1';
  RAISE NOTICE 'RESEED_13_CUSTOMER: create customer via customer RPC with seed_key=% (no Auth invent)', v_key;
END $$;
