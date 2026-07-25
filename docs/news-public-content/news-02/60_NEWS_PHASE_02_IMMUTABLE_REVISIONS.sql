-- =============================================================================
-- NEWS-02 — Immutable revision protection
-- Purpose: Block UPDATE/DELETE of revisions once approved or published.
-- Status: AUTHORED ONLY — NOT APPLIED in NEWS-02.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.news_phase02_reject_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = OLD.content_id
        AND (
          i.approved_revision_id = OLD.revision_id
          OR i.published_revision_id = OLD.revision_id
        )
    ) THEN
      RAISE EXCEPTION 'NEWS_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = format('cannot delete approved/published revision %s', OLD.revision_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.news_public_content_items i
      WHERE i.content_id = OLD.content_id
        AND (
          i.approved_revision_id = OLD.revision_id
          OR i.published_revision_id = OLD.revision_id
        )
    ) THEN
      RAISE EXCEPTION 'NEWS_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = format('cannot mutate approved/published revision %s', OLD.revision_id);
    END IF;
    -- Even for non-published revisions, reject payload mutation (identity-only allowlist none)
    IF NEW.revision_id IS DISTINCT FROM OLD.revision_id
       OR NEW.content_id IS DISTINCT FROM OLD.content_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.locale IS DISTINCT FROM OLD.locale
       OR NEW.body_payload IS DISTINCT FROM OLD.body_payload
       OR NEW.seo_metadata IS DISTINCT FROM OLD.seo_metadata
       OR NEW.banner_payload IS DISTINCT FROM OLD.banner_payload
       OR NEW.sponsor_payload IS DISTINCT FROM OLD.sponsor_payload
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'NEWS_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = format('revision payload is immutable: %s', OLD.revision_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS news_public_content_revisions_immutable_trg
  ON public.news_public_content_revisions;

CREATE TRIGGER news_public_content_revisions_immutable_trg
  BEFORE UPDATE OR DELETE ON public.news_public_content_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.news_phase02_reject_revision_mutation();

REVOKE ALL ON FUNCTION public.news_phase02_reject_revision_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.news_phase02_reject_revision_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.news_phase02_reject_revision_mutation() FROM authenticated;
