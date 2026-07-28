-- PLATFORM-HARD-CUTOVER-01 reseed step 03 — Venue / court_clusters
-- NOT EXECUTED. Depends on Club. Does NOT mutate Owner venue id.

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_club text := current_setting('app.reseed_club_id', true);
  v_key text;
  v_n int;
BEGIN
  IF v_tenant IS NULL OR v_club IS NULL THEN
    RAISE EXCEPTION 'RESEED_03_VENUE: app.reseed_tenant_id and app.reseed_club_id required';
  END IF;
  v_key := 'hard-cutover-seed::' || v_tenant || '::cluster::primary';

  SELECT count(*) INTO v_n
  FROM public.court_clusters
  WHERE coalesce(meta->>'seed_key', name) = v_key
     OR name = v_key;

  IF v_n > 0 THEN
    RAISE NOTICE 'RESEED_03_VENUE: duplicate cluster key=% — skip', v_key;
    RETURN;
  END IF;

  RAISE NOTICE 'RESEED_03_VENUE: insert court_clusters row with seed_key=% for club=% (Operator)', v_key, v_club;
END $$;
