-- PLATFORM-HARD-CUTOVER-01 reseed step 12 — Public Catalog projections
-- NOT EXECUTED. Republish via catalog RPCs / jobs — no anon invent.

DO $$
BEGIN
  RAISE NOTICE 'RESEED_12_PUBLIC_CATALOG: republish clubs/courts/tournaments/rankings projections after club+court seed';
  RAISE NOTICE 'RESEED_12_PUBLIC_CATALOG: verify via public_catalog_list_* RPCs (anon-safe fields only)';
END $$;

-- VERIFY (Operator):
-- SELECT public.public_catalog_list_clubs(...);
-- SELECT public.public_catalog_list_courts(...);
