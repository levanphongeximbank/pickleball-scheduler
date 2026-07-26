-- =============================================================================
-- PUBLIC-CATALOG-01E — Staging Publication Evidence Seed Rollback
-- Purpose: Delete ONLY exact synthetic seed rows created by 10_PC01E_STAGING_SEED.sql.
-- Target: Staging ONLY (qyewbxjsiiyufanzcjcq). Production: DO NOT APPLY.
-- Safety:
--   - Exact ID deletes only (no broad WHERE).
--   - Dependency order: courts → clubs → venue.
--   - Does NOT drop RPCs, projection table, RLS, or PUBLIC-CATALOG-01S objects.
--   - Fails if unexpected remaining PC01E namespace rows exist after deletes.
-- =============================================================================

SET search_path = public, pg_temp;

DO $$
DECLARE
  v_remaining integer;
BEGIN
  -- 1) Courts (exact IDs)
  DELETE FROM public.public_catalog_courts
  WHERE id IN ('PICKVN_PC01E_PUBLIC_COURT', 'PICKVN_PC01E_PRIVATE_COURT');

  -- 2) Clubs (exact IDs)
  DELETE FROM public.clubs
  WHERE id IN ('PICKVN_PC01E_PUBLIC_CLUB', 'PICKVN_PC01E_PRIVATE_CLUB');

  -- 3) Venue (exact ID)
  DELETE FROM public.venues
  WHERE id = 'PICKVN_PC01E_VENUE';

  -- Post-delete namespace integrity (fail on orphans / unexpected ownership)
  SELECT count(*)::integer INTO v_remaining FROM (
    SELECT id FROM public.venues WHERE id = 'PICKVN_PC01E_VENUE' OR slug = 'pickvn-pc01e-venue'
    UNION ALL
    SELECT id FROM public.clubs
    WHERE id LIKE 'PICKVN_PC01E_%'
       OR public_slug LIKE 'pickvn-pc01e-%'
       OR name LIKE 'PICKVN PC01E%'
    UNION ALL
    SELECT id FROM public.public_catalog_courts
    WHERE id LIKE 'PICKVN_PC01E_%'
       OR display_name LIKE 'PICKVN PC01E%'
  ) leftovers;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'PC01E_ROLLBACK_INCOMPLETE: % unexpected PC01E namespace row(s) remain', v_remaining
      USING ERRCODE = 'P0001';
  END IF;

  RAISE NOTICE 'PC01E_ROLLBACK_OK: exact seed rows removed; namespace clean';
END $$;

-- Post-rollback verification (expected empty / baseline)
-- SELECT count(*) FROM public.clubs WHERE id LIKE 'PICKVN_PC01E_%';
-- SELECT count(*) FROM public.public_catalog_courts WHERE id LIKE 'PICKVN_PC01E_%';
-- SELECT count(*) FROM public.venues WHERE id = 'PICKVN_PC01E_VENUE';
-- SELECT count(*) FROM public.public_catalog_list_clubs(50,0,'name_asc') WHERE id LIKE 'PICKVN_PC01E_%';
-- SELECT count(*) FROM public.public_catalog_list_courts(50,0,'name_asc',NULL) WHERE id LIKE 'PICKVN_PC01E_%';
