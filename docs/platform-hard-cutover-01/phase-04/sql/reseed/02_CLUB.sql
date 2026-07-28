-- PLATFORM-HARD-CUTOVER-01 reseed step 02 — Club
-- NOT EXECUTED in this PR. Idempotent external_key pattern.
-- Prefer security-definer club_create RPC when available; duplicate-detect via clubs/club_data_v3.

-- Parameters (set by Operator before run — never invent Owner UUID):
--   :tenant_id text  — Owner venue id (text)
--   :seed_key  text  — 'hard-cutover-seed::{tenant}::club::primary'

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_key text := coalesce(
    nullif(current_setting('app.reseed_club_key', true), ''),
    'hard-cutover-seed::' || coalesce(v_tenant, 'MISSING') || '::club::primary'
  );
  v_existing uuid;
BEGIN
  IF v_tenant IS NULL OR length(trim(v_tenant)) = 0 THEN
    RAISE EXCEPTION 'RESEED_02_CLUB: app.reseed_tenant_id required (Owner venue id)';
  END IF;

  SELECT id INTO v_existing
  FROM public.clubs
  WHERE tenant_id::text = v_tenant
    AND (
      id::text = v_key
      OR coalesce(external_key, '') = v_key
      OR coalesce(meta->>'seed_key', '') = v_key
    )
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'RESEED_02_CLUB: duplicate detected club_id=% key=% — skip insert', v_existing, v_key;
    RETURN;
  END IF;

  -- Operator must call club_create RPC with authenticated Owner JWT.
  -- This package does not invent Auth actors.
  RAISE NOTICE 'RESEED_02_CLUB: no duplicate — call public.club_create(...) with seed_key=% under Owner session', v_key;
END $$;

-- VERIFY
-- SELECT id, name FROM public.clubs WHERE coalesce(meta->>'seed_key','') LIKE 'hard-cutover-seed::%';
