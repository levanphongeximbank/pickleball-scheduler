-- PLATFORM-HARD-CUTOVER-01 reseed step 17 — Coaching first-use
-- NOT EXECUTED.
-- Under hard cutover: durable coaching_* only (never pickleball-coaching-v1 localStorage).
-- If durable backend missing → typed UNAVAILABLE (fail closed).

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_club text := current_setting('app.reseed_club_id', true);
  v_key text;
BEGIN
  IF v_tenant IS NULL OR v_club IS NULL THEN
    RAISE EXCEPTION 'RESEED_17_COACHING: tenant + club required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::coaching::class1';
  RAISE NOTICE 'RESEED_17_COACHING: create coaching class/coach via durable RPC seed_key=% club=%', v_key, v_club;
  RAISE NOTICE 'RESEED_17_COACHING: VERIFY reload persistence + tenant isolation + role auth after seed';
END $$;
