-- PLATFORM-HARD-CUTOVER-01 reseed step 14 — CRM first-use
-- NOT EXECUTED. Depends on Customer.

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_key text;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'RESEED_14_CRM: tenant required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::crm::lead1';
  RAISE NOTICE 'RESEED_14_CRM: create CRM lead/message via crm_* RPC seed_key=%', v_key;
END $$;
