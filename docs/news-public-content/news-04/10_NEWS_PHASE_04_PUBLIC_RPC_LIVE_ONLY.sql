-- =============================================================================
-- NEWS-04 — Public RPC LIVE-only boundary remediation
-- Purpose:
--   Harden news_public_content_query_public so PREVIEW/MOCK never cross the
--   public backend boundary. Align partial public index with LIVE-only filter.
-- Ownership: News & Public Content (not Experience Channels / UI filtering).
-- Status: AUTHORED remediation package. NOT auto-applied.
-- Apply: Staging only after explicit Owner GO (new confirmation beyond NEWS-03).
-- Production: DO NOT APPLY.
-- Idempotency: CREATE OR REPLACE function; DROP/CREATE index.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.news_public_content_query_public(
  p_now timestamptz DEFAULT now(),
  p_locale text DEFAULT NULL,
  p_content_scope text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  content_id text,
  content_type text,
  content_scope text,
  title text,
  summary text,
  slug text,
  locale text,
  category_references jsonb,
  tag_references jsonb,
  media_references jsonb,
  seo_metadata jsonb,
  published_at timestamptz,
  publish_at timestamptz,
  unpublish_at timestamptz,
  publication_timezone text,
  revision_id text,
  version integer,
  provenance text,
  tenant_id text,
  venue_id text,
  club_id text,
  competition_id text,
  banner jsonb,
  sponsor jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    i.content_id,
    i.content_type,
    i.content_scope,
    r.title,
    r.summary,
    r.slug,
    r.locale,
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'categoryId', c.category_id,
          'slug', c.slug,
          'displayLabel', c.display_label,
          'locale', c.locale
        )
        ORDER BY c.sort_order, c.category_id
      )
      FROM public.news_public_content_category_refs c
      WHERE c.content_id = i.content_id AND c.revision_id = r.revision_id
    ), '[]'::jsonb) AS category_references,
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'tagId', t.tag_id,
          'slug', t.slug,
          'label', t.label,
          'locale', t.locale
        )
        ORDER BY t.sort_order, t.tag_id
      )
      FROM public.news_public_content_tag_refs t
      WHERE t.content_id = i.content_id AND t.revision_id = r.revision_id
    ), '[]'::jsonb) AS tag_references,
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'mediaId', m.media_id,
          'mediaKind', m.media_kind,
          'url', m.url,
          'altText', m.alt_text,
          'caption', m.caption,
          'locale', m.locale,
          'attribution', m.attribution
        )
        ORDER BY m.sort_order, m.media_id
      )
      FROM public.news_public_content_media_refs m
      WHERE m.content_id = i.content_id AND m.revision_id = r.revision_id
    ), '[]'::jsonb) AS media_references,
    r.seo_metadata,
    i.published_at,
    i.publish_at,
    i.unpublish_at,
    i.publication_timezone,
    r.revision_id,
    r.version,
    i.provenance,
    i.tenant_id,
    i.venue_id,
    i.club_id,
    i.competition_id,
    CASE
      WHEN r.banner_payload IS NULL THEN NULL
      ELSE jsonb_build_object(
        'placement', r.banner_payload ->> 'placement',
        'media', r.banner_payload -> 'media',
        'destination', r.banner_payload -> 'destination'
      )
    END AS banner,
    CASE
      WHEN r.sponsor_payload IS NULL THEN NULL
      ELSE jsonb_build_object(
        'sponsorId', r.sponsor_payload ->> 'sponsorId',
        'disclosureLabel', r.sponsor_payload ->> 'disclosureLabel',
        'media', r.sponsor_payload -> 'media',
        'destination', r.sponsor_payload -> 'destination'
      )
    END AS sponsor
  FROM public.news_public_content_items i
  INNER JOIN public.news_public_content_revisions r
    ON r.revision_id = i.published_revision_id
   AND r.content_id = i.content_id
  WHERE i.editorial_status = 'PUBLISHED'
    AND i.public_visibility = 'PUBLIC'
    AND i.archived_at IS NULL
    AND i.provenance = 'LIVE'
    AND i.published_revision_id IS NOT NULL
    AND (i.publish_at IS NULL OR i.publish_at <= p_now)
    AND (i.unpublish_at IS NULL OR i.unpublish_at > p_now)
    AND (p_locale IS NULL OR r.locale = p_locale)
    AND (p_content_scope IS NULL OR i.content_scope = p_content_scope)
  ORDER BY i.published_at DESC NULLS LAST, i.content_id
  LIMIT GREATEST(1, LEAST(coalesce(p_limit, 50), 200));
$$;

COMMENT ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) IS
  'NEWS public read contract: PUBLISHED + PUBLIC + LIVE only. Excludes MOCK/PREVIEW/DRAFT/unpublished/expired/archived. NEWS-04 remediation.';

REVOKE ALL ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO service_role;

-- Align public-window partial index with LIVE-only boundary
DROP INDEX IF EXISTS public.news_public_content_items_public_window_idx;
CREATE INDEX IF NOT EXISTS news_public_content_items_public_window_idx
  ON public.news_public_content_items (editorial_status, public_visibility, publish_at, unpublish_at)
  WHERE editorial_status = 'PUBLISHED'
    AND public_visibility = 'PUBLIC'
    AND archived_at IS NULL
    AND provenance = 'LIVE';
