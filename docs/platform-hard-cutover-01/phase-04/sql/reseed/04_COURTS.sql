-- PLATFORM-HARD-CUTOVER-01 reseed step 04 — Courts inventory
-- NOT EXECUTED. Depends on court_clusters.

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_key text;
  v_n int;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'RESEED_04_COURTS: app.reseed_tenant_id required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::court::1';

  SELECT count(*) INTO v_n
  FROM public.courts
  WHERE coalesce(meta->>'seed_key', name) = v_key
     OR name = v_key;

  IF v_n > 0 THEN
    RAISE NOTICE 'RESEED_04_COURTS: duplicate court key=% — skip', v_key;
    RETURN;
  END IF;

  RAISE NOTICE 'RESEED_04_COURTS: create court inventory under cluster with seed_key=% (Operator via court RPC/admin)', v_key;
END $$;
