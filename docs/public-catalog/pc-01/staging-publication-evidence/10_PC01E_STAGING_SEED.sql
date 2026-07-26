-- =============================================================================
-- PUBLIC-CATALOG-01E — Staging Publication Evidence Seed
-- Purpose: Minimal synthetic public/private controls for anon RPC verification.
-- Target: Staging ONLY (qyewbxjsiiyufanzcjcq). Production: DO NOT APPLY.
-- Namespace: PICKVN_PC01E_*
-- Safety:
--   - Fail-safe if any exact seed ID/slug already exists (no overwrite).
--   - No GRANT/REVOKE, no RLS changes, no RPC definition changes.
--   - Synthetic only — no real PII / booking / payment data.
-- Rollback: 90_PC01E_STAGING_SEED_ROLLBACK.sql (exact IDs only).
-- =============================================================================

SET search_path = public, pg_temp;

DO $$
DECLARE
  v_marker text := 'PUBLIC-CATALOG-01E seed @ 2026-07-26';
  v_conflict text;
BEGIN
  -- Exact-ID / slug collision gate (fail before any insert).
  SELECT x.id INTO v_conflict
  FROM (
    SELECT id FROM public.venues WHERE id = 'PICKVN_PC01E_VENUE' OR slug = 'pickvn-pc01e-venue'
    UNION ALL
    SELECT id FROM public.clubs
    WHERE id IN ('PICKVN_PC01E_PUBLIC_CLUB', 'PICKVN_PC01E_PRIVATE_CLUB')
       OR public_slug IN ('pickvn-pc01e-public-club', 'pickvn-pc01e-private-control')
       OR name IN ('PICKVN PC01E Public Club', 'PICKVN PC01E Private Control')
    UNION ALL
    SELECT id FROM public.public_catalog_courts
    WHERE id IN ('PICKVN_PC01E_PUBLIC_COURT', 'PICKVN_PC01E_PRIVATE_COURT')
       OR display_name IN ('PICKVN PC01E Public Court', 'PICKVN PC01E Private Control Court')
  ) x
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'PC01E_SEED_CONFLICT: seed identifier already exists (%). Abort without mutation.', v_conflict
      USING ERRCODE = '23505';
  END IF;

  -- 1) Synthetic venue (clubs.tenant_id FK → venues.id)
  INSERT INTO public.venues (id, name, slug, timezone, status, note)
  VALUES (
    'PICKVN_PC01E_VENUE',
    'PICKVN PC01E Synthetic Venue',
    'pickvn-pc01e-venue',
    'Asia/Ho_Chi_Minh',
    'trial',
    v_marker
  );

  -- 2) Public club (must appear via public_catalog_list_clubs)
  INSERT INTO public.clubs (
    id, tenant_id, name, code, description, status,
    is_publicly_listed, public_slug, public_location_summary,
    public_logo_url, public_cover_image_url, public_contact
  ) VALUES (
    'PICKVN_PC01E_PUBLIC_CLUB',
    'PICKVN_PC01E_VENUE',
    'PICKVN PC01E Public Club',
    'PC01E_PUB',
    'Synthetic public club for PUBLIC-CATALOG-01E publication evidence. Not a real organization.',
    'active',
    true,
    'pickvn-pc01e-public-club',
    'Synthetic District, Staging City',
    NULL,
    NULL,
    NULL
  );

  -- 3) Private/unpublished control club (must NOT appear via anon RPC)
  INSERT INTO public.clubs (
    id, tenant_id, name, code, description, status,
    is_publicly_listed, public_slug, public_location_summary,
    public_logo_url, public_cover_image_url, public_contact
  ) VALUES (
    'PICKVN_PC01E_PRIVATE_CLUB',
    'PICKVN_PC01E_VENUE',
    'PICKVN PC01E Private Control',
    'PC01E_PRIV',
    'Synthetic private control club for PUBLIC-CATALOG-01E. Must remain unpublished.',
    'active',
    false,
    'pickvn-pc01e-private-control',
    'Synthetic Private Control Location',
    NULL,
    NULL,
    NULL
  );

  -- 4) Public court projection (must appear via public_catalog_list_courts)
  INSERT INTO public.public_catalog_courts (
    id, club_id, venue_id, display_name, court_type, surface,
    availability_descriptor, publication_state, operational_state
  ) VALUES (
    'PICKVN_PC01E_PUBLIC_COURT',
    'PICKVN_PC01E_PUBLIC_CLUB',
    'PICKVN_PC01E_VENUE',
    'PICKVN PC01E Public Court',
    'outdoor',
    'synthetic-surface',
    'Synthetic availability descriptor for PC01E',
    'published',
    'active'
  );

  -- 5) Private control court (private-club + unpublished — must NOT appear)
  INSERT INTO public.public_catalog_courts (
    id, club_id, venue_id, display_name, court_type, surface,
    availability_descriptor, publication_state, operational_state
  ) VALUES (
    'PICKVN_PC01E_PRIVATE_COURT',
    'PICKVN_PC01E_PRIVATE_CLUB',
    'PICKVN_PC01E_VENUE',
    'PICKVN PC01E Private Control Court',
    'indoor',
    'synthetic-surface',
    'Synthetic private control — must not publish',
    'unpublished',
    'active'
  );

  RAISE NOTICE 'PC01E_SEED_OK: created venue=1 clubs=2 courts=2 marker=%', v_marker;
END $$;
