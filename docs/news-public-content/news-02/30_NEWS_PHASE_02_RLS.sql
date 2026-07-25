-- =============================================================================
-- NEWS-02 — RLS enablement and fail-closed policies
-- Purpose: Editorial RLS + public-read RPC boundary for News tables.
-- Helpers: auth.uid(), public.user_venue_id(), public.user_has_permission(text),
--          public.is_super_admin() — verified PICK_VN helpers only.
-- Status: AUTHORED ONLY — NOT APPLIED in NEWS-02.
--
-- Write boundary:
--   Authenticated JWT may SELECT editorial rows when capability + scope allow.
--   Authenticated INSERT/UPDATE/DELETE policies are intentionally ABSENT.
--   Aggregate writes go through trusted service_role / SECURITY DEFINER RPCs.
--
-- Public boundary:
--   No anon SELECT on base editorial tables.
--   Public read via news_public_content_query_public SECURITY DEFINER RPC only.
--
-- No USING (true). No WITH CHECK (true). No invented tenant resolver.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Editorial scope helper (fail-closed Sprint-2 venue-bound identity)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_phase02_editorial_scope_allows(
  p_content_scope text,
  p_tenant_id text,
  p_venue_id text,
  p_club_id text,
  p_competition_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR (
        public.user_venue_id() IS NOT NULL
        AND CASE coalesce(p_content_scope, '')
          WHEN 'PLATFORM' THEN false
          WHEN 'TENANT' THEN
            p_tenant_id IS NOT NULL
            AND length(trim(p_tenant_id)) > 0
            AND p_tenant_id = public.user_venue_id()
            AND p_venue_id IS NULL
          WHEN 'VENUE' THEN
            p_tenant_id IS NOT NULL
            AND p_venue_id IS NOT NULL
            AND p_tenant_id = public.user_venue_id()
            AND p_venue_id = public.user_venue_id()
          WHEN 'CLUB' THEN
            p_tenant_id IS NOT NULL
            AND p_club_id IS NOT NULL
            AND length(trim(p_club_id)) > 0
            AND p_tenant_id = public.user_venue_id()
          WHEN 'COMPETITION' THEN
            p_tenant_id IS NOT NULL
            AND p_competition_id IS NOT NULL
            AND length(trim(p_competition_id)) > 0
            AND p_tenant_id = public.user_venue_id()
          ELSE false
        END
      )
    );
$$;

COMMENT ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) IS
  'NEWS-02 fail-closed editorial scope gate. PLATFORM requires is_super_admin(). Scoped rows require tenant_id = user_venue_id() (Sprint-2).';

REVOKE ALL ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.news_phase02_has_editorial_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.is_super_admin()
    OR public.user_has_permission('news.view')
    OR public.user_has_permission('news.edit')
    OR public.user_has_permission('news.review')
    OR public.user_has_permission('news.approve')
    OR public.user_has_permission('news.publish')
    OR public.user_has_permission('news.admin');
$$;

REVOKE ALL ON FUNCTION public.news_phase02_has_editorial_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.news_phase02_has_editorial_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.news_phase02_has_editorial_read() TO service_role;

-- -----------------------------------------------------------------------------
-- Enable + FORCE RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.news_public_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_category_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_tag_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_media_refs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.news_public_content_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_category_refs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_tag_refs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.news_public_content_media_refs FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Drop prior NEWS-02 policies (idempotent re-author)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS news_public_content_items_select ON public.news_public_content_items;
DROP POLICY IF EXISTS news_public_content_revisions_select ON public.news_public_content_revisions;
DROP POLICY IF EXISTS news_public_content_reviews_select ON public.news_public_content_reviews;
DROP POLICY IF EXISTS news_public_content_approvals_select ON public.news_public_content_approvals;
DROP POLICY IF EXISTS news_public_content_category_refs_select ON public.news_public_content_category_refs;
DROP POLICY IF EXISTS news_public_content_tag_refs_select ON public.news_public_content_tag_refs;
DROP POLICY IF EXISTS news_public_content_media_refs_select ON public.news_public_content_media_refs;

-- No anon policies on base tables. No authenticated write policies.

CREATE POLICY news_public_content_items_select ON public.news_public_content_items
  FOR SELECT
  TO authenticated
  USING (
    public.news_phase02_editorial_scope_allows(
      content_scope, tenant_id, venue_id, club_id, competition_id
    )
    AND public.news_phase02_has_editorial_read()
  );

CREATE POLICY news_public_content_revisions_select ON public.news_public_content_revisions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = news_public_content_revisions.content_id
        AND public.news_phase02_editorial_scope_allows(
          i.content_scope, i.tenant_id, i.venue_id, i.club_id, i.competition_id
        )
        AND public.news_phase02_has_editorial_read()
    )
  );

CREATE POLICY news_public_content_reviews_select ON public.news_public_content_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = news_public_content_reviews.content_id
        AND public.news_phase02_editorial_scope_allows(
          i.content_scope, i.tenant_id, i.venue_id, i.club_id, i.competition_id
        )
        AND public.news_phase02_has_editorial_read()
    )
  );

CREATE POLICY news_public_content_approvals_select ON public.news_public_content_approvals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = news_public_content_approvals.content_id
        AND public.news_phase02_editorial_scope_allows(
          i.content_scope, i.tenant_id, i.venue_id, i.club_id, i.competition_id
        )
        AND public.news_phase02_has_editorial_read()
    )
  );

CREATE POLICY news_public_content_category_refs_select ON public.news_public_content_category_refs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = news_public_content_category_refs.content_id
        AND public.news_phase02_editorial_scope_allows(
          i.content_scope, i.tenant_id, i.venue_id, i.club_id, i.competition_id
        )
        AND public.news_phase02_has_editorial_read()
    )
  );

CREATE POLICY news_public_content_tag_refs_select ON public.news_public_content_tag_refs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = news_public_content_tag_refs.content_id
        AND public.news_phase02_editorial_scope_allows(
          i.content_scope, i.tenant_id, i.venue_id, i.club_id, i.competition_id
        )
        AND public.news_phase02_has_editorial_read()
    )
  );

CREATE POLICY news_public_content_media_refs_select ON public.news_public_content_media_refs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = news_public_content_media_refs.content_id
        AND public.news_phase02_editorial_scope_allows(
          i.content_scope, i.tenant_id, i.venue_id, i.club_id, i.competition_id
        )
        AND public.news_phase02_has_editorial_read()
    )
  );
