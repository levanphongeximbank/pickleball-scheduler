-- =============================================================================
-- NEWS-02 — Indexes and partial uniqueness
-- Purpose: Query support + slug uniqueness without NULL loopholes.
-- Status: AUTHORED ONLY — NOT APPLIED in NEWS-02.
-- Idempotency: CREATE INDEX IF NOT EXISTS.
-- =============================================================================

SET search_path = public, pg_temp;

-- Editorial / OCC lookups
CREATE INDEX IF NOT EXISTS news_public_content_items_status_idx
  ON public.news_public_content_items (editorial_status);

CREATE INDEX IF NOT EXISTS news_public_content_items_provenance_idx
  ON public.news_public_content_items (provenance);

CREATE INDEX IF NOT EXISTS news_public_content_items_updated_at_idx
  ON public.news_public_content_items (updated_at DESC);

CREATE INDEX IF NOT EXISTS news_public_content_items_tenant_status_idx
  ON public.news_public_content_items (tenant_id, editorial_status)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS news_public_content_items_venue_status_idx
  ON public.news_public_content_items (venue_id, editorial_status)
  WHERE venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS news_public_content_items_club_status_idx
  ON public.news_public_content_items (club_id, editorial_status)
  WHERE club_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS news_public_content_items_competition_status_idx
  ON public.news_public_content_items (competition_id, editorial_status)
  WHERE competition_id IS NOT NULL;

-- Public read support
CREATE INDEX IF NOT EXISTS news_public_content_items_public_window_idx
  ON public.news_public_content_items (editorial_status, public_visibility, publish_at, unpublish_at)
  WHERE editorial_status = 'PUBLISHED'
    AND public_visibility = 'PUBLIC'
    AND archived_at IS NULL
    AND provenance <> 'MOCK';

-- Revisions
CREATE INDEX IF NOT EXISTS news_public_content_revisions_content_idx
  ON public.news_public_content_revisions (content_id, version DESC);

CREATE INDEX IF NOT EXISTS news_public_content_revisions_slug_locale_idx
  ON public.news_public_content_revisions (slug, locale);

-- Partial unique slug indexes by scope (no nullable composite loophole)
CREATE UNIQUE INDEX IF NOT EXISTS news_public_content_slug_platform_uq
  ON public.news_public_content_revisions (slug, locale)
  WHERE content_scope = 'PLATFORM';

CREATE UNIQUE INDEX IF NOT EXISTS news_public_content_slug_tenant_uq
  ON public.news_public_content_revisions (tenant_id, slug, locale)
  WHERE content_scope = 'TENANT' AND tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS news_public_content_slug_venue_uq
  ON public.news_public_content_revisions (venue_id, slug, locale)
  WHERE content_scope = 'VENUE' AND venue_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS news_public_content_slug_club_uq
  ON public.news_public_content_revisions (club_id, slug, locale)
  WHERE content_scope = 'CLUB' AND club_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS news_public_content_slug_competition_uq
  ON public.news_public_content_revisions (competition_id, slug, locale)
  WHERE content_scope = 'COMPETITION' AND competition_id IS NOT NULL;

-- Review / approval lookups
CREATE INDEX IF NOT EXISTS news_public_content_reviews_content_idx
  ON public.news_public_content_reviews (content_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS news_public_content_reviews_revision_idx
  ON public.news_public_content_reviews (revision_id);

CREATE INDEX IF NOT EXISTS news_public_content_approvals_content_idx
  ON public.news_public_content_approvals (content_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS news_public_content_approvals_revision_idx
  ON public.news_public_content_approvals (revision_id);

CREATE INDEX IF NOT EXISTS news_public_content_category_refs_revision_idx
  ON public.news_public_content_category_refs (revision_id, sort_order);

CREATE INDEX IF NOT EXISTS news_public_content_tag_refs_revision_idx
  ON public.news_public_content_tag_refs (revision_id, sort_order);

CREATE INDEX IF NOT EXISTS news_public_content_media_refs_revision_idx
  ON public.news_public_content_media_refs (revision_id, sort_order);
