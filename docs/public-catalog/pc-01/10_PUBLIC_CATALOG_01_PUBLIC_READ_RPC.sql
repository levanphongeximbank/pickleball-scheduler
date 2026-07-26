-- =============================================================================
-- PUBLIC-CATALOG-01 — Clubs & Courts Remote Public Read RPCs
-- Purpose:
--   Provide SECURITY DEFINER, allowlisted, anon-executable public read RPCs
--   for Clubs and Courts. Deny-by-default publication (is_publicly_listed=false).
--   Courts are served from a dedicated public-safe projection table — never from
--   club_data_v3 jsonb or pricing/booking/staff columns.
-- Ownership: Public Catalog (not Experience Channels cutover).
-- Status: AUTHORED package. NOT auto-applied.
-- Apply: Staging only after explicit Owner GO. Production: DO NOT APPLY.
-- Idempotency: ADD COLUMN IF NOT EXISTS; CREATE OR REPLACE FUNCTION; CREATE TABLE IF NOT EXISTS.
-- =============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 1) Clubs — opt-in public listing columns (deny-by-default)
-- ---------------------------------------------------------------------------

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS is_publicly_listed boolean NOT NULL DEFAULT false;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS public_slug text NULL;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS public_location_summary text NULL;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS public_logo_url text NULL;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS public_cover_image_url text NULL;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS public_contact text NULL;

COMMENT ON COLUMN public.clubs.is_publicly_listed IS
  'PUBLIC-CATALOG-01: opt-in public catalog listing. Default false (deny-by-default).';

CREATE INDEX IF NOT EXISTS clubs_public_listed_idx
  ON public.clubs (is_publicly_listed, status)
  WHERE deleted_at IS NULL AND is_publicly_listed = true;

-- ---------------------------------------------------------------------------
-- 2) Courts — dedicated public-safe projection table (no private columns)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_catalog_courts (
  id text PRIMARY KEY,
  club_id text NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  venue_id text NOT NULL,
  display_name text NOT NULL,
  court_type text NULL
    CHECK (court_type IS NULL OR court_type IN ('indoor', 'outdoor', 'covered')),
  surface text NULL,
  availability_descriptor text NULL,
  publication_state text NOT NULL DEFAULT 'published'
    CHECK (publication_state IN ('published', 'unpublished', 'archived')),
  operational_state text NOT NULL DEFAULT 'active'
    CHECK (operational_state IN ('active', 'locked', 'maintenance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_catalog_courts_club_idx
  ON public.public_catalog_courts (club_id);

CREATE INDEX IF NOT EXISTS public_catalog_courts_public_idx
  ON public.public_catalog_courts (publication_state, operational_state, display_name, id)
  WHERE publication_state = 'published' AND operational_state = 'active';

ALTER TABLE public.public_catalog_courts ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: no direct anon/authenticated table policies.
-- Public reads MUST go through SECURITY DEFINER RPC only.
DROP POLICY IF EXISTS public_catalog_courts_deny_all ON public.public_catalog_courts;
-- Intentionally no permissive policies.

REVOKE ALL ON TABLE public.public_catalog_courts FROM PUBLIC;
REVOKE ALL ON TABLE public.public_catalog_courts FROM anon;
REVOKE ALL ON TABLE public.public_catalog_courts FROM authenticated;
GRANT ALL ON TABLE public.public_catalog_courts TO service_role;

-- ---------------------------------------------------------------------------
-- 3) public_catalog_list_clubs — allowlisted columns only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_catalog_list_clubs(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'name_asc'
)
RETURNS TABLE (
  id text,
  display_name text,
  slug text,
  description text,
  logo_url text,
  image_url text,
  location_summary text,
  publication_state text,
  public_contact text,
  total_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer;
  v_offset integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION: limit must be between 1 and 50'
      USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION: offset must be >= 0'
      USING ERRCODE = '22023';
  END IF;
  IF p_sort IS DISTINCT FROM 'name_asc' THEN
    RAISE EXCEPTION 'INVALID_SORT: unsupported club sort'
      USING ERRCODE = '22023';
  END IF;

  v_limit := p_limit;
  v_offset := p_offset;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      c.id,
      c.name AS display_name,
      c.public_slug AS slug,
      NULLIF(btrim(c.description), '') AS description,
      c.public_logo_url AS logo_url,
      c.public_cover_image_url AS image_url,
      c.public_location_summary AS location_summary,
      'published'::text AS publication_state,
      c.public_contact AS public_contact
    FROM public.clubs c
    WHERE c.is_publicly_listed = true
      AND c.status = 'active'
      AND c.deleted_at IS NULL
  ),
  counted AS (
    SELECT count(*)::integer AS total_count FROM eligible
  )
  SELECT
    e.id,
    e.display_name,
    e.slug,
    e.description,
    e.logo_url,
    e.image_url,
    e.location_summary,
    e.publication_state,
    e.public_contact,
    counted.total_count
  FROM eligible e
  CROSS JOIN counted
  ORDER BY e.display_name ASC, e.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) IS
  'PUBLIC-CATALOG-01: anon public club list — allowlisted columns; deny-by-default listing.';

REVOKE ALL ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_clubs(integer, integer, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) public_catalog_list_courts — projection table only (no blob / rates)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_catalog_list_courts(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'name_asc',
  p_club_id text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  club_id text,
  venue_id text,
  display_name text,
  court_type text,
  surface text,
  availability_descriptor text,
  publication_state text,
  operational_state text,
  total_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer;
  v_offset integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION: limit must be between 1 and 50'
      USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION: offset must be >= 0'
      USING ERRCODE = '22023';
  END IF;
  IF p_sort IS DISTINCT FROM 'name_asc' THEN
    RAISE EXCEPTION 'INVALID_SORT: unsupported court sort'
      USING ERRCODE = '22023';
  END IF;
  IF p_club_id IS NOT NULL AND btrim(p_club_id) = '' THEN
    RAISE EXCEPTION 'INVALID_FILTER: club_id must be non-empty when provided'
      USING ERRCODE = '22023';
  END IF;

  v_limit := p_limit;
  v_offset := p_offset;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      pc.id,
      pc.club_id,
      pc.venue_id,
      pc.display_name,
      pc.court_type,
      pc.surface,
      pc.availability_descriptor,
      pc.publication_state,
      pc.operational_state
    FROM public.public_catalog_courts pc
    INNER JOIN public.clubs c
      ON c.id = pc.club_id
     AND c.is_publicly_listed = true
     AND c.status = 'active'
     AND c.deleted_at IS NULL
    WHERE pc.publication_state = 'published'
      AND pc.operational_state = 'active'
      AND (p_club_id IS NULL OR pc.club_id = p_club_id)
  ),
  counted AS (
    SELECT count(*)::integer AS total_count FROM eligible
  )
  SELECT
    e.id,
    e.club_id,
    e.venue_id,
    e.display_name,
    e.court_type,
    e.surface,
    e.availability_descriptor,
    e.publication_state,
    e.operational_state,
    counted.total_count
  FROM eligible e
  CROSS JOIN counted
  ORDER BY e.display_name ASC, e.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) IS
  'PUBLIC-CATALOG-01: anon public court list — projection table only; no rates/bookings/PII.';

REVOKE ALL ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_courts(integer, integer, text, text) TO service_role;
