-- =============================================================================
-- NEWS-02 — Grants and security hardening
-- Purpose: Restrict table/RPC grants. No anonymous base-table access.
-- Status: AUTHORED ONLY — NOT APPLIED in NEWS-02.
-- =============================================================================

SET search_path = public, pg_temp;

-- Base tables: revoke broad grants
REVOKE ALL ON TABLE public.news_public_content_items FROM PUBLIC;
REVOKE ALL ON TABLE public.news_public_content_items FROM anon;
REVOKE ALL ON TABLE public.news_public_content_revisions FROM PUBLIC;
REVOKE ALL ON TABLE public.news_public_content_revisions FROM anon;
REVOKE ALL ON TABLE public.news_public_content_reviews FROM PUBLIC;
REVOKE ALL ON TABLE public.news_public_content_reviews FROM anon;
REVOKE ALL ON TABLE public.news_public_content_approvals FROM PUBLIC;
REVOKE ALL ON TABLE public.news_public_content_approvals FROM anon;
REVOKE ALL ON TABLE public.news_public_content_category_refs FROM PUBLIC;
REVOKE ALL ON TABLE public.news_public_content_category_refs FROM anon;
REVOKE ALL ON TABLE public.news_public_content_tag_refs FROM PUBLIC;
REVOKE ALL ON TABLE public.news_public_content_tag_refs FROM anon;
REVOKE ALL ON TABLE public.news_public_content_media_refs FROM PUBLIC;
REVOKE ALL ON TABLE public.news_public_content_media_refs FROM anon;

-- Authenticated: SELECT only (writes blocked at policy + grant level)
GRANT SELECT ON TABLE public.news_public_content_items TO authenticated;
GRANT SELECT ON TABLE public.news_public_content_revisions TO authenticated;
GRANT SELECT ON TABLE public.news_public_content_reviews TO authenticated;
GRANT SELECT ON TABLE public.news_public_content_approvals TO authenticated;
GRANT SELECT ON TABLE public.news_public_content_category_refs TO authenticated;
GRANT SELECT ON TABLE public.news_public_content_tag_refs TO authenticated;
GRANT SELECT ON TABLE public.news_public_content_media_refs TO authenticated;

-- service_role: full DML for trusted server adapters (bypasses RLS in Supabase)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_public_content_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_public_content_revisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_public_content_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_public_content_approvals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_public_content_category_refs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_public_content_tag_refs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_public_content_media_refs TO service_role;

-- RPC grants reaffirmed
REVOKE ALL ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) FROM anon;
REVOKE ALL ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) TO service_role;

REVOKE ALL ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.news_phase02_editorial_scope_allows(text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.news_phase02_has_editorial_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.news_phase02_has_editorial_read() FROM anon;
GRANT EXECUTE ON FUNCTION public.news_phase02_has_editorial_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.news_phase02_has_editorial_read() TO service_role;
