-- =============================================================================
-- PUBLIC-CATALOG-02 — Tournaments & Rankings Remote Public Read RPCs
-- Purpose:
--   Provide SECURITY DEFINER, allowlisted, anon-executable public read RPCs
--   for Tournaments and Rankings via dedicated public-safe projection tables.
--   Deny-by-default publication (empty projection = LIVE + EMPTY).
-- Ownership: Public Catalog (not Experience Channels cutover; not CM/VPR writers).
-- Status: AUTHORED package. Staging apply after Owner GO. Production: DO NOT APPLY
--   until exact Owner message: GO PUBLIC CATALOG 02 PRODUCTION
-- Idempotency: CREATE TABLE IF NOT EXISTS; CREATE OR REPLACE FUNCTION.
-- =============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 1) Tournaments — dedicated public-safe projection (no competition blob / ops)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_catalog_tournaments (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  slug text NULL,
  sport text NOT NULL DEFAULT 'pickleball',
  publication_state text NOT NULL DEFAULT 'published'
    CHECK (publication_state IN ('published', 'unpublished', 'archived')),
  operational_status text NOT NULL DEFAULT 'upcoming'
    CHECK (operational_status IN ('upcoming', 'live', 'finished')),
  start_date date NULL,
  end_date date NULL,
  location_summary text NULL,
  format_summary text NULL,
  category_summary text NULL,
  image_url text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_catalog_tournaments_public_idx
  ON public.public_catalog_tournaments (publication_state, operational_status, display_name, id)
  WHERE publication_state = 'published';

ALTER TABLE public.public_catalog_tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_catalog_tournaments_deny_all ON public.public_catalog_tournaments;
-- Intentionally no permissive policies.

REVOKE ALL ON TABLE public.public_catalog_tournaments FROM PUBLIC;
REVOKE ALL ON TABLE public.public_catalog_tournaments FROM anon;
REVOKE ALL ON TABLE public.public_catalog_tournaments FROM authenticated;
GRANT ALL ON TABLE public.public_catalog_tournaments TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Rankings — dedicated public-safe projection (not Player Rating; not ops)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_catalog_rankings (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  club_name text NULL,
  region text NULL,
  category text NOT NULL DEFAULT 'men_single',
  gender text NULL,
  rank integer NOT NULL CHECK (rank >= 1),
  total_points integer NOT NULL DEFAULT 0,
  tournaments_count integer NOT NULL DEFAULT 0,
  best_placement text NULL,
  publication_state text NOT NULL DEFAULT 'published'
    CHECK (publication_state IN ('published', 'unpublished', 'archived')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_catalog_rankings_public_idx
  ON public.public_catalog_rankings (publication_state, category, rank, id)
  WHERE publication_state = 'published';

ALTER TABLE public.public_catalog_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_catalog_rankings_deny_all ON public.public_catalog_rankings;
-- Intentionally no permissive policies.

REVOKE ALL ON TABLE public.public_catalog_rankings FROM PUBLIC;
REVOKE ALL ON TABLE public.public_catalog_rankings FROM anon;
REVOKE ALL ON TABLE public.public_catalog_rankings FROM authenticated;
GRANT ALL ON TABLE public.public_catalog_rankings TO service_role;

-- ---------------------------------------------------------------------------
-- 3) public_catalog_list_tournaments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_catalog_list_tournaments(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'name_asc'
)
RETURNS TABLE (
  id text,
  display_name text,
  slug text,
  sport text,
  publication_state text,
  operational_status text,
  start_date date,
  end_date date,
  location_summary text,
  format_summary text,
  category_summary text,
  image_url text,
  updated_at timestamptz,
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
    RAISE EXCEPTION 'INVALID_SORT: unsupported tournament sort'
      USING ERRCODE = '22023';
  END IF;

  v_limit := p_limit;
  v_offset := p_offset;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      t.id,
      t.display_name,
      t.slug,
      t.sport,
      t.publication_state,
      t.operational_status,
      t.start_date,
      t.end_date,
      t.location_summary,
      t.format_summary,
      t.category_summary,
      t.image_url,
      t.updated_at
    FROM public.public_catalog_tournaments t
    WHERE t.publication_state = 'published'
  ),
  counted AS (
    SELECT count(*)::integer AS total_count FROM eligible
  )
  SELECT
    e.id,
    e.display_name,
    e.slug,
    e.sport,
    e.publication_state,
    e.operational_status,
    e.start_date,
    e.end_date,
    e.location_summary,
    e.format_summary,
    e.category_summary,
    e.image_url,
    e.updated_at,
    counted.total_count
  FROM eligible e
  CROSS JOIN counted
  ORDER BY e.display_name ASC, e.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.public_catalog_list_tournaments(integer, integer, text) IS
  'PUBLIC-CATALOG-02: anon public tournament list — projection table only; deny-by-default.';

REVOKE ALL ON FUNCTION public.public_catalog_list_tournaments(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_tournaments(integer, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_tournaments(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_tournaments(integer, integer, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) public_catalog_list_rankings
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_catalog_list_rankings(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'rank_asc',
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  display_name text,
  club_name text,
  region text,
  category text,
  gender text,
  rank integer,
  total_points integer,
  tournaments_count integer,
  best_placement text,
  publication_state text,
  updated_at timestamptz,
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
  IF p_sort IS DISTINCT FROM 'rank_asc' THEN
    RAISE EXCEPTION 'INVALID_SORT: unsupported ranking sort'
      USING ERRCODE = '22023';
  END IF;
  IF p_category IS NOT NULL AND btrim(p_category) = '' THEN
    RAISE EXCEPTION 'INVALID_FILTER: category must be non-empty when provided'
      USING ERRCODE = '22023';
  END IF;

  v_limit := p_limit;
  v_offset := p_offset;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      r.id,
      r.display_name,
      r.club_name,
      r.region,
      r.category,
      r.gender,
      r.rank,
      r.total_points,
      r.tournaments_count,
      r.best_placement,
      r.publication_state,
      r.updated_at
    FROM public.public_catalog_rankings r
    WHERE r.publication_state = 'published'
      AND (p_category IS NULL OR r.category = p_category)
  ),
  counted AS (
    SELECT count(*)::integer AS total_count FROM eligible
  )
  SELECT
    e.id,
    e.display_name,
    e.club_name,
    e.region,
    e.category,
    e.gender,
    e.rank,
    e.total_points,
    e.tournaments_count,
    e.best_placement,
    e.publication_state,
    e.updated_at,
    counted.total_count
  FROM eligible e
  CROSS JOIN counted
  ORDER BY e.rank ASC, e.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.public_catalog_list_rankings(integer, integer, text, text) IS
  'PUBLIC-CATALOG-02: anon public ranking list — projection table only; no player PII.';

REVOKE ALL ON FUNCTION public.public_catalog_list_rankings(integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_rankings(integer, integer, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_rankings(integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_list_rankings(integer, integer, text, text) TO service_role;
