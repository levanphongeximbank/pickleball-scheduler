-- =============================================================================
-- NEWS-02 — Rollback (authored; do NOT run in NEWS-02)
-- Purpose: Forward remediation / controlled rollback for NEWS-03+ if needed.
-- Status: AUTHORED ONLY — not executed automatically.
-- =============================================================================

SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS news_public_content_revisions_immutable_trg
  ON public.news_public_content_revisions;
DROP FUNCTION IF EXISTS public.news_phase02_reject_revision_mutation();

DROP FUNCTION IF EXISTS public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer);
DROP FUNCTION IF EXISTS public.news_public_content_query_public(timestamptz, text, text, integer);
DROP FUNCTION IF EXISTS public.news_phase02_has_editorial_read();
DROP FUNCTION IF EXISTS public.news_phase02_editorial_scope_allows(text, text, text, text, text);

DROP TABLE IF EXISTS public.news_public_content_media_refs CASCADE;
DROP TABLE IF EXISTS public.news_public_content_tag_refs CASCADE;
DROP TABLE IF EXISTS public.news_public_content_category_refs CASCADE;
DROP TABLE IF EXISTS public.news_public_content_approvals CASCADE;
DROP TABLE IF EXISTS public.news_public_content_reviews CASCADE;

-- Break circular FKs before dropping items/revisions
ALTER TABLE IF EXISTS public.news_public_content_items
  DROP CONSTRAINT IF EXISTS news_public_content_items_current_revision_fk;
ALTER TABLE IF EXISTS public.news_public_content_items
  DROP CONSTRAINT IF EXISTS news_public_content_items_approved_revision_fk;
ALTER TABLE IF EXISTS public.news_public_content_items
  DROP CONSTRAINT IF EXISTS news_public_content_items_published_revision_fk;

DROP TABLE IF EXISTS public.news_public_content_revisions CASCADE;
DROP TABLE IF EXISTS public.news_public_content_items CASCADE;
