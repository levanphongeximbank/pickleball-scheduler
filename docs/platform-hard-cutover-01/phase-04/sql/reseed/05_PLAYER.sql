-- PLATFORM-HARD-CUTOVER-01 reseed step 05 — Player identity
-- NOT EXECUTED. No Auth user creation. Club-scoped athlete/player rows only.

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_club text := current_setting('app.reseed_club_id', true);
  v_key text;
BEGIN
  IF v_tenant IS NULL OR v_club IS NULL THEN
    RAISE EXCEPTION 'RESEED_05_PLAYER: tenant + club required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::player::p1';
  RAISE NOTICE 'RESEED_05_PLAYER: upsert player mapping seed_key=% club=% — no auth.users insert', v_key, v_club;
END $$;
