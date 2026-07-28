-- PLATFORM-HARD-CUTOVER-01 reseed step 06 — Rating profile (V5 durable)
-- NOT EXECUTED. Requires VITE_PICK_VN_RATING_V5_ENABLED at runtime after seed.
-- Idempotency key: hard-cutover-seed::{tenant}::rating::{player_id}

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_player text := current_setting('app.reseed_player_id', true);
  v_idem text;
BEGIN
  IF v_tenant IS NULL OR v_player IS NULL THEN
    RAISE EXCEPTION 'RESEED_06_RATING: tenant + player required';
  END IF;
  v_idem := 'hard-cutover-seed::' || v_tenant || '::rating::' || v_player;
  RAISE NOTICE 'RESEED_06_RATING: call rating V5 RPC with idempotency_key=% (no club-blob verified write)', v_idem;
END $$;
