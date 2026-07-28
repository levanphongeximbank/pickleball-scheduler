-- PLATFORM-HARD-CUTOVER-01 reseed step 15 — Finance first-use
-- NOT EXECUTED. Finance ledger ≠ billing plan catalog (plans protected).

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_key text;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'RESEED_15_FINANCE: tenant required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::finance::entry1';
  RAISE NOTICE 'RESEED_15_FINANCE: create finance_* entry via RPC seed_key=% — do not mutate plans catalog', v_key;
END $$;
