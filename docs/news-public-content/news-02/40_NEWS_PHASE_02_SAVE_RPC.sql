-- =============================================================================
-- NEWS-02 — Save aggregate RPC + public query RPC
-- Purpose:
--   1) news_public_content_save_aggregate — trusted write + OCC
--   2) news_public_content_query_public — sanitized public read contract
-- Status: AUTHORED ONLY — NOT APPLIED in NEWS-02.
-- Security: SECURITY DEFINER, pinned search_path.
--   save: EXECUTE service_role only
--   query_public: EXECUTE anon + authenticated + service_role
-- Actor identity: NEVER taken from caller-supplied privilege claims for authz.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Public read RPC (NEWS-03 contract surface)
-- -----------------------------------------------------------------------------
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
  'NEWS public read contract: PUBLISHED + PUBLIC + LIVE only. Excludes MOCK/PREVIEW/DRAFT/unpublished/expired/archived. No reviewer/approver/internal comments. Hardened in NEWS-04.';

REVOKE ALL ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.news_public_content_query_public(timestamptz, text, text, integer) TO service_role;

-- -----------------------------------------------------------------------------
-- Editorial aggregate save with optimistic concurrency
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_public_content_save_aggregate(
  p_item jsonb,
  p_revision jsonb,
  p_category_refs jsonb DEFAULT '[]'::jsonb,
  p_tag_refs jsonb DEFAULT '[]'::jsonb,
  p_media_refs jsonb DEFAULT '[]'::jsonb,
  p_review jsonb DEFAULT NULL,
  p_approval jsonb DEFAULT NULL,
  p_expected_row_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_content_id text;
  v_row_version integer;
  v_existing_version integer;
  v_revision_id text;
  v_version integer;
  v_result jsonb;
BEGIN
  IF p_item IS NULL OR jsonb_typeof(p_item) <> 'object' THEN
    RAISE EXCEPTION 'news_public_content_save_aggregate: item payload required'
      USING ERRCODE = '22023';
  END IF;
  IF p_revision IS NULL OR jsonb_typeof(p_revision) <> 'object' THEN
    RAISE EXCEPTION 'news_public_content_save_aggregate: revision payload required'
      USING ERRCODE = '22023';
  END IF;

  v_content_id := nullif(trim(p_item ->> 'content_id'), '');
  v_row_version := (p_item ->> 'row_version')::integer;
  v_revision_id := nullif(trim(p_revision ->> 'revision_id'), '');
  v_version := (p_revision ->> 'version')::integer;

  IF v_content_id IS NULL OR v_revision_id IS NULL THEN
    RAISE EXCEPTION 'news_public_content_save_aggregate: content_id and revision_id required'
      USING ERRCODE = '22023';
  END IF;
  IF v_row_version IS NULL OR v_row_version < 1 OR v_version IS NULL OR v_version < 1 THEN
    RAISE EXCEPTION 'news_public_content_save_aggregate: versions must be >= 1'
      USING ERRCODE = '22023';
  END IF;

  -- Reject MOCK provenance on PUBLISHED
  IF coalesce(p_item ->> 'editorial_status', '') = 'PUBLISHED'
     AND coalesce(p_item ->> 'provenance', '') = 'MOCK' THEN
    RAISE EXCEPTION 'NEWS_PROVENANCE_MISMATCH'
      USING ERRCODE = 'P0001',
            DETAIL = 'MOCK content cannot be published';
  END IF;

  SELECT i.row_version
    INTO v_existing_version
  FROM public.news_public_content_items i
  WHERE i.content_id = v_content_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF v_row_version <> 1 OR coalesce(p_expected_row_version, 0) NOT IN (0, 1) THEN
      RAISE EXCEPTION 'NEWS_VERSION_CONFLICT'
        USING ERRCODE = 'P0001',
              DETAIL = format('create requires row_version=1, received=%s', v_row_version);
    END IF;

    INSERT INTO public.news_public_content_items (
      content_id, content_type, content_scope,
      tenant_id, venue_id, club_id, competition_id,
      author_id, editorial_owner_id,
      editorial_status, public_visibility, provenance,
      current_revision_id, approved_revision_id, published_revision_id,
      publish_at, unpublish_at, publication_timezone,
      published_at, unpublished_at, archived_at,
      row_version, created_at, updated_at
    ) VALUES (
      v_content_id,
      trim(p_item ->> 'content_type'),
      trim(p_item ->> 'content_scope'),
      nullif(trim(p_item ->> 'tenant_id'), ''),
      nullif(trim(p_item ->> 'venue_id'), ''),
      nullif(trim(p_item ->> 'club_id'), ''),
      nullif(trim(p_item ->> 'competition_id'), ''),
      trim(p_item ->> 'author_id'),
      trim(p_item ->> 'editorial_owner_id'),
      trim(p_item ->> 'editorial_status'),
      coalesce(nullif(trim(p_item ->> 'public_visibility'), ''), 'PUBLIC'),
      trim(p_item ->> 'provenance'),
      NULL,
      nullif(trim(p_item ->> 'approved_revision_id'), ''),
      nullif(trim(p_item ->> 'published_revision_id'), ''),
      NULLIF(p_item ->> 'publish_at', '')::timestamptz,
      NULLIF(p_item ->> 'unpublish_at', '')::timestamptz,
      nullif(trim(p_item ->> 'publication_timezone'), ''),
      NULLIF(p_item ->> 'published_at', '')::timestamptz,
      NULLIF(p_item ->> 'unpublished_at', '')::timestamptz,
      NULLIF(p_item ->> 'archived_at', '')::timestamptz,
      v_row_version,
      (p_item ->> 'created_at')::timestamptz,
      (p_item ->> 'updated_at')::timestamptz
    );
  ELSE
    IF p_expected_row_version IS NOT NULL AND v_existing_version <> p_expected_row_version THEN
      RAISE EXCEPTION 'NEWS_VERSION_CONFLICT'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'expected=%s actual=%s received=%s',
                p_expected_row_version, v_existing_version, v_row_version
              );
    END IF;
    IF v_row_version <> v_existing_version + 1 THEN
      RAISE EXCEPTION 'NEWS_VERSION_CONFLICT'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'expected_previous=%s actual=%s received=%s',
                v_row_version - 1, v_existing_version, v_row_version
              );
    END IF;

    UPDATE public.news_public_content_items
    SET
      content_type = trim(p_item ->> 'content_type'),
      content_scope = trim(p_item ->> 'content_scope'),
      tenant_id = nullif(trim(p_item ->> 'tenant_id'), ''),
      venue_id = nullif(trim(p_item ->> 'venue_id'), ''),
      club_id = nullif(trim(p_item ->> 'club_id'), ''),
      competition_id = nullif(trim(p_item ->> 'competition_id'), ''),
      author_id = trim(p_item ->> 'author_id'),
      editorial_owner_id = trim(p_item ->> 'editorial_owner_id'),
      editorial_status = trim(p_item ->> 'editorial_status'),
      public_visibility = coalesce(nullif(trim(p_item ->> 'public_visibility'), ''), 'PUBLIC'),
      provenance = trim(p_item ->> 'provenance'),
      approved_revision_id = nullif(trim(p_item ->> 'approved_revision_id'), ''),
      published_revision_id = nullif(trim(p_item ->> 'published_revision_id'), ''),
      publish_at = NULLIF(p_item ->> 'publish_at', '')::timestamptz,
      unpublish_at = NULLIF(p_item ->> 'unpublish_at', '')::timestamptz,
      publication_timezone = nullif(trim(p_item ->> 'publication_timezone'), ''),
      published_at = NULLIF(p_item ->> 'published_at', '')::timestamptz,
      unpublished_at = NULLIF(p_item ->> 'unpublished_at', '')::timestamptz,
      archived_at = NULLIF(p_item ->> 'archived_at', '')::timestamptz,
      row_version = v_row_version,
      updated_at = (p_item ->> 'updated_at')::timestamptz
    WHERE content_id = v_content_id
      AND row_version = v_existing_version;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'NEWS_VERSION_CONFLICT'
        USING ERRCODE = 'P0001',
              DETAIL = 'concurrent update lost race';
    END IF;
  END IF;

  -- Insert revision if new (immutable: never update existing payload)
  IF NOT EXISTS (
    SELECT 1 FROM public.news_public_content_revisions r WHERE r.revision_id = v_revision_id
  ) THEN
    INSERT INTO public.news_public_content_revisions (
      revision_id, content_id, version,
      content_scope, tenant_id, venue_id, club_id, competition_id,
      title, summary, slug, locale,
      body_payload, seo_metadata, banner_payload, sponsor_payload,
      created_by, created_at
    ) VALUES (
      v_revision_id,
      v_content_id,
      v_version,
      trim(p_item ->> 'content_scope'),
      nullif(trim(p_item ->> 'tenant_id'), ''),
      nullif(trim(p_item ->> 'venue_id'), ''),
      nullif(trim(p_item ->> 'club_id'), ''),
      nullif(trim(p_item ->> 'competition_id'), ''),
      trim(p_revision ->> 'title'),
      coalesce(p_revision ->> 'summary', ''),
      trim(p_revision ->> 'slug'),
      trim(p_revision ->> 'locale'),
      coalesce(p_revision -> 'body_payload', '{}'::jsonb),
      coalesce(p_revision -> 'seo_metadata', '{}'::jsonb),
      p_revision -> 'banner_payload',
      p_revision -> 'sponsor_payload',
      trim(p_revision ->> 'created_by'),
      (p_revision ->> 'created_at')::timestamptz
    );
  ELSE
    -- Existing revision must match content/version; payload stays immutable
    IF EXISTS (
      SELECT 1
      FROM public.news_public_content_revisions r
      WHERE r.revision_id = v_revision_id
        AND (r.content_id <> v_content_id OR r.version <> v_version)
    ) THEN
      RAISE EXCEPTION 'NEWS_INVALID_REVISION_VERSION'
        USING ERRCODE = 'P0001',
              DETAIL = 'revision identity mismatch';
    END IF;
  END IF;

  UPDATE public.news_public_content_items
  SET current_revision_id = v_revision_id
  WHERE content_id = v_content_id;

  -- Replace refs for this revision (deterministic)
  DELETE FROM public.news_public_content_category_refs
  WHERE content_id = v_content_id AND revision_id = v_revision_id;
  DELETE FROM public.news_public_content_tag_refs
  WHERE content_id = v_content_id AND revision_id = v_revision_id;
  DELETE FROM public.news_public_content_media_refs
  WHERE content_id = v_content_id AND revision_id = v_revision_id;

  INSERT INTO public.news_public_content_category_refs (
    content_id, revision_id, category_id, slug, display_label, locale, sort_order
  )
  SELECT
    v_content_id,
    v_revision_id,
    trim(elem ->> 'category_id'),
    trim(elem ->> 'slug'),
    trim(elem ->> 'display_label'),
    trim(elem ->> 'locale'),
    coalesce((elem ->> 'sort_order')::integer, ord::integer - 1)
  FROM jsonb_array_elements(coalesce(p_category_refs, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord);

  INSERT INTO public.news_public_content_tag_refs (
    content_id, revision_id, tag_id, slug, label, locale, sort_order
  )
  SELECT
    v_content_id,
    v_revision_id,
    trim(elem ->> 'tag_id'),
    trim(elem ->> 'slug'),
    trim(elem ->> 'label'),
    trim(elem ->> 'locale'),
    coalesce((elem ->> 'sort_order')::integer, ord::integer - 1)
  FROM jsonb_array_elements(coalesce(p_tag_refs, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord);

  INSERT INTO public.news_public_content_media_refs (
    content_id, revision_id, media_id, media_kind, url,
    alt_text, caption, locale, attribution, sort_order
  )
  SELECT
    v_content_id,
    v_revision_id,
    trim(elem ->> 'media_id'),
    trim(elem ->> 'media_kind'),
    trim(elem ->> 'url'),
    nullif(trim(elem ->> 'alt_text'), ''),
    nullif(trim(elem ->> 'caption'), ''),
    nullif(trim(elem ->> 'locale'), ''),
    nullif(trim(elem ->> 'attribution'), ''),
    coalesce((elem ->> 'sort_order')::integer, ord::integer - 1)
  FROM jsonb_array_elements(coalesce(p_media_refs, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord);

  IF p_review IS NOT NULL AND jsonb_typeof(p_review) = 'object' THEN
    INSERT INTO public.news_public_content_reviews (
      review_id, content_id, revision_id, revision_version,
      reviewer_id, decision, comment_text, decided_at
    ) VALUES (
      trim(p_review ->> 'review_id'),
      v_content_id,
      coalesce(nullif(trim(p_review ->> 'revision_id'), ''), v_revision_id),
      coalesce((p_review ->> 'revision_version')::integer, v_version),
      trim(p_review ->> 'reviewer_id'),
      trim(p_review ->> 'decision'),
      nullif(trim(p_review ->> 'comment_text'), ''),
      (p_review ->> 'decided_at')::timestamptz
    )
    ON CONFLICT (review_id) DO NOTHING;
  END IF;

  IF p_approval IS NOT NULL AND jsonb_typeof(p_approval) = 'object' THEN
    -- Stale approval (wrong revision) rejected
    IF coalesce(nullif(trim(p_approval ->> 'revision_id'), ''), v_revision_id) <> v_revision_id
       OR coalesce((p_approval ->> 'revision_version')::integer, v_version) <> v_version THEN
      RAISE EXCEPTION 'NEWS_APPROVAL_REVISION_MISMATCH'
        USING ERRCODE = 'P0001',
              DETAIL = 'approval must bind to current revision';
    END IF;

    INSERT INTO public.news_public_content_approvals (
      approval_id, content_id, revision_id, revision_version,
      approver_id, decision, reason, decided_at
    ) VALUES (
      trim(p_approval ->> 'approval_id'),
      v_content_id,
      v_revision_id,
      v_version,
      trim(p_approval ->> 'approver_id'),
      trim(p_approval ->> 'decision'),
      nullif(trim(p_approval ->> 'reason'), ''),
      (p_approval ->> 'decided_at')::timestamptz
    )
    ON CONFLICT (approval_id) DO NOTHING;

    IF trim(p_approval ->> 'decision') = 'APPROVED' THEN
      UPDATE public.news_public_content_items
      SET approved_revision_id = v_revision_id
      WHERE content_id = v_content_id;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'content_id', i.content_id,
    'row_version', i.row_version,
    'current_revision_id', i.current_revision_id,
    'editorial_status', i.editorial_status
  )
  INTO v_result
  FROM public.news_public_content_items i
  WHERE i.content_id = v_content_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) IS
  'NEWS-02 trusted aggregate save with row_version CAS. service_role only. Not applied in NEWS-02.';

REVOKE ALL ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) FROM anon;
REVOKE ALL ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.news_public_content_save_aggregate(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer) TO service_role;
