-- PLATFORM-HARD-CUTOVER-01 reseed step 16 — News first-use
-- NOT EXECUTED. Admin news RPC only; public read via news_public_content_query_public.

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_key text;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'RESEED_16_NEWS: tenant required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::news::n1';
  RAISE NOTICE 'RESEED_16_NEWS: publish news via admin RPC seed_key=% — no MOCK_NEWS invent', v_key;
END $$;
