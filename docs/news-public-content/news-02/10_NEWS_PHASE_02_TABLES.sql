-- =============================================================================
-- NEWS-02 — Tables and constraints
-- Purpose: Durable persistence for News & Public Content aggregate
--          (items, immutable revisions, reviews, approvals, refs).
-- Schema: public
-- Status: AUTHORED ONLY — NOT APPLIED to Staging or Production in NEWS-02.
--         Apply belongs to NEWS-03 with separate Owner authorization.
-- Idempotency: CREATE TABLE IF NOT EXISTS; constraints via DO blocks.
-- Destructive: none. No Production IDs. No secrets. No auto-apply.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. news_public_content_items (aggregate root)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_public_content_items (
  content_id text PRIMARY KEY,
  content_type text NOT NULL,
  content_scope text NOT NULL,
  tenant_id text NULL,
  venue_id text NULL,
  club_id text NULL,
  competition_id text NULL,
  author_id text NOT NULL,
  editorial_owner_id text NOT NULL,
  editorial_status text NOT NULL,
  public_visibility text NOT NULL DEFAULT 'PUBLIC',
  provenance text NOT NULL,
  current_revision_id text NULL,
  approved_revision_id text NULL,
  published_revision_id text NULL,
  publish_at timestamptz NULL,
  unpublish_at timestamptz NULL,
  publication_timezone text NULL,
  published_at timestamptz NULL,
  unpublished_at timestamptz NULL,
  archived_at timestamptz NULL,
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT news_public_content_items_content_type_chk
    CHECK (content_type IN (
      'NEWS', 'ARTICLE', 'ANNOUNCEMENT', 'TOURNAMENT_CONTENT',
      'VENUE_CONTENT', 'CLUB_CONTENT', 'BANNER', 'SPONSOR_CONTENT'
    )),
  CONSTRAINT news_public_content_items_content_scope_chk
    CHECK (content_scope IN ('PLATFORM', 'TENANT', 'VENUE', 'CLUB', 'COMPETITION')),
  CONSTRAINT news_public_content_items_editorial_status_chk
    CHECK (editorial_status IN (
      'DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED',
      'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'
    )),
  CONSTRAINT news_public_content_items_public_visibility_chk
    CHECK (public_visibility IN ('PUBLIC', 'UNLISTED', 'PRIVATE')),
  CONSTRAINT news_public_content_items_provenance_chk
    CHECK (provenance IN ('LIVE', 'MOCK', 'PREVIEW')),
  CONSTRAINT news_public_content_items_published_not_mock
    CHECK (editorial_status <> 'PUBLISHED' OR provenance <> 'MOCK'),
  CONSTRAINT news_public_content_items_author_nonempty
    CHECK (length(trim(author_id)) > 0),
  CONSTRAINT news_public_content_items_editorial_owner_nonempty
    CHECK (length(trim(editorial_owner_id)) > 0),
  CONSTRAINT news_public_content_items_row_version_positive
    CHECK (row_version >= 1),
  CONSTRAINT news_public_content_items_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT news_public_content_items_window_order
    CHECK (unpublish_at IS NULL OR publish_at IS NULL OR unpublish_at > publish_at),
  CONSTRAINT news_public_content_items_scheduled_requires_publish_at
    CHECK (editorial_status <> 'SCHEDULED' OR publish_at IS NOT NULL),
  CONSTRAINT news_public_content_items_archived_blocks_published
    CHECK (archived_at IS NULL OR editorial_status = 'ARCHIVED'),
  CONSTRAINT news_public_content_items_scope_platform
    CHECK (
      content_scope <> 'PLATFORM'
      OR (
        tenant_id IS NULL AND venue_id IS NULL
        AND club_id IS NULL AND competition_id IS NULL
      )
    ),
  CONSTRAINT news_public_content_items_scope_tenant
    CHECK (
      content_scope <> 'TENANT'
      OR (
        tenant_id IS NOT NULL AND length(trim(tenant_id)) > 0
        AND venue_id IS NULL AND club_id IS NULL AND competition_id IS NULL
      )
    ),
  CONSTRAINT news_public_content_items_scope_venue
    CHECK (
      content_scope <> 'VENUE'
      OR (
        tenant_id IS NOT NULL AND length(trim(tenant_id)) > 0
        AND venue_id IS NOT NULL AND length(trim(venue_id)) > 0
        AND club_id IS NULL AND competition_id IS NULL
      )
    ),
  CONSTRAINT news_public_content_items_scope_club
    CHECK (
      content_scope <> 'CLUB'
      OR (
        tenant_id IS NOT NULL AND length(trim(tenant_id)) > 0
        AND club_id IS NOT NULL AND length(trim(club_id)) > 0
        AND competition_id IS NULL
      )
    ),
  CONSTRAINT news_public_content_items_scope_competition
    CHECK (
      content_scope <> 'COMPETITION'
      OR (
        tenant_id IS NOT NULL AND length(trim(tenant_id)) > 0
        AND competition_id IS NOT NULL AND length(trim(competition_id)) > 0
        AND club_id IS NULL
      )
    )
);

COMMENT ON TABLE public.news_public_content_items IS
  'NEWS-02 content aggregate root. Optimistic concurrency via row_version. SQL authored; not applied in NEWS-02.';

COMMENT ON COLUMN public.news_public_content_items.row_version IS
  'Maps to domain content.version. Create starts at 1. CAS updates require expected previous version.';

-- -----------------------------------------------------------------------------
-- 2. news_public_content_revisions (immutable payloads)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_public_content_revisions (
  revision_id text PRIMARY KEY,
  content_id text NOT NULL,
  version integer NOT NULL,
  content_scope text NOT NULL,
  tenant_id text NULL,
  venue_id text NULL,
  club_id text NULL,
  competition_id text NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  slug text NOT NULL,
  locale text NOT NULL,
  body_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  banner_payload jsonb NULL,
  sponsor_payload jsonb NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT news_public_content_revisions_version_positive
    CHECK (version >= 1),
  CONSTRAINT news_public_content_revisions_content_scope_chk
    CHECK (content_scope IN ('PLATFORM', 'TENANT', 'VENUE', 'CLUB', 'COMPETITION')),
  CONSTRAINT news_public_content_revisions_title_nonempty
    CHECK (length(trim(title)) > 0),
  CONSTRAINT news_public_content_revisions_slug_nonempty
    CHECK (length(trim(slug)) > 0),
  CONSTRAINT news_public_content_revisions_locale_nonempty
    CHECK (length(trim(locale)) > 0),
  CONSTRAINT news_public_content_revisions_created_by_nonempty
    CHECK (length(trim(created_by)) > 0),
  CONSTRAINT news_public_content_revisions_body_object
    CHECK (jsonb_typeof(body_payload) = 'object'),
  CONSTRAINT news_public_content_revisions_seo_object
    CHECK (jsonb_typeof(seo_metadata) = 'object'),
  CONSTRAINT news_public_content_revisions_banner_object
    CHECK (banner_payload IS NULL OR jsonb_typeof(banner_payload) = 'object'),
  CONSTRAINT news_public_content_revisions_sponsor_object
    CHECK (sponsor_payload IS NULL OR jsonb_typeof(sponsor_payload) = 'object'),
  CONSTRAINT news_public_content_revisions_content_fk
    FOREIGN KEY (content_id)
    REFERENCES public.news_public_content_items (content_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'news_public_content_revisions_content_version_uq'
      AND conrelid = 'public.news_public_content_revisions'::regclass
  ) THEN
    ALTER TABLE public.news_public_content_revisions
      ADD CONSTRAINT news_public_content_revisions_content_version_uq
      UNIQUE (content_id, version);
  END IF;
END $$;

COMMENT ON TABLE public.news_public_content_revisions IS
  'NEWS-02 immutable content revisions. Unique (content_id, version). Do not silently mutate approved/published revisions.';

-- Item revision FK pointers (added after revisions exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'news_public_content_items_current_revision_fk'
      AND conrelid = 'public.news_public_content_items'::regclass
  ) THEN
    ALTER TABLE public.news_public_content_items
      ADD CONSTRAINT news_public_content_items_current_revision_fk
      FOREIGN KEY (current_revision_id)
      REFERENCES public.news_public_content_revisions (revision_id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'news_public_content_items_approved_revision_fk'
      AND conrelid = 'public.news_public_content_items'::regclass
  ) THEN
    ALTER TABLE public.news_public_content_items
      ADD CONSTRAINT news_public_content_items_approved_revision_fk
      FOREIGN KEY (approved_revision_id)
      REFERENCES public.news_public_content_revisions (revision_id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'news_public_content_items_published_revision_fk'
      AND conrelid = 'public.news_public_content_items'::regclass
  ) THEN
    ALTER TABLE public.news_public_content_items
      ADD CONSTRAINT news_public_content_items_published_revision_fk
      FOREIGN KEY (published_revision_id)
      REFERENCES public.news_public_content_revisions (revision_id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. news_public_content_reviews
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_public_content_reviews (
  review_id text PRIMARY KEY,
  content_id text NOT NULL,
  revision_id text NOT NULL,
  revision_version integer NOT NULL,
  reviewer_id text NOT NULL,
  decision text NOT NULL,
  comment_text text NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT news_public_content_reviews_decision_chk
    CHECK (decision IN ('REQUEST_CHANGES', 'APPROVE_FOR_EDITORIAL')),
  CONSTRAINT news_public_content_reviews_version_positive
    CHECK (revision_version >= 1),
  CONSTRAINT news_public_content_reviews_reviewer_nonempty
    CHECK (length(trim(reviewer_id)) > 0),
  CONSTRAINT news_public_content_reviews_content_fk
    FOREIGN KEY (content_id)
    REFERENCES public.news_public_content_items (content_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT news_public_content_reviews_revision_fk
    FOREIGN KEY (revision_id)
    REFERENCES public.news_public_content_revisions (revision_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.news_public_content_reviews IS
  'NEWS-02 editorial review decisions bound to a specific revision.';

-- -----------------------------------------------------------------------------
-- 4. news_public_content_approvals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_public_content_approvals (
  approval_id text PRIMARY KEY,
  content_id text NOT NULL,
  revision_id text NOT NULL,
  revision_version integer NOT NULL,
  approver_id text NOT NULL,
  decision text NOT NULL,
  reason text NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT news_public_content_approvals_decision_chk
    CHECK (decision IN ('APPROVED', 'REJECTED')),
  CONSTRAINT news_public_content_approvals_version_positive
    CHECK (revision_version >= 1),
  CONSTRAINT news_public_content_approvals_approver_nonempty
    CHECK (length(trim(approver_id)) > 0),
  CONSTRAINT news_public_content_approvals_content_fk
    FOREIGN KEY (content_id)
    REFERENCES public.news_public_content_items (content_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT news_public_content_approvals_revision_fk
    FOREIGN KEY (revision_id)
    REFERENCES public.news_public_content_revisions (revision_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.news_public_content_approvals IS
  'NEWS-02 approval decisions bound to a specific revision. New revisions do not inherit prior approval.';

-- -----------------------------------------------------------------------------
-- 5. Category / tag / media references
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_public_content_category_refs (
  content_id text NOT NULL,
  revision_id text NOT NULL,
  category_id text NOT NULL,
  slug text NOT NULL,
  display_label text NOT NULL,
  locale text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (content_id, revision_id, category_id),
  CONSTRAINT news_public_content_category_refs_sort_nonneg
    CHECK (sort_order >= 0),
  CONSTRAINT news_public_content_category_refs_content_fk
    FOREIGN KEY (content_id)
    REFERENCES public.news_public_content_items (content_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT news_public_content_category_refs_revision_fk
    FOREIGN KEY (revision_id)
    REFERENCES public.news_public_content_revisions (revision_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS public.news_public_content_tag_refs (
  content_id text NOT NULL,
  revision_id text NOT NULL,
  tag_id text NOT NULL,
  slug text NOT NULL,
  label text NOT NULL,
  locale text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (content_id, revision_id, tag_id),
  CONSTRAINT news_public_content_tag_refs_sort_nonneg
    CHECK (sort_order >= 0),
  CONSTRAINT news_public_content_tag_refs_content_fk
    FOREIGN KEY (content_id)
    REFERENCES public.news_public_content_items (content_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT news_public_content_tag_refs_revision_fk
    FOREIGN KEY (revision_id)
    REFERENCES public.news_public_content_revisions (revision_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS public.news_public_content_media_refs (
  content_id text NOT NULL,
  revision_id text NOT NULL,
  media_id text NOT NULL,
  media_kind text NOT NULL,
  url text NOT NULL,
  alt_text text NULL,
  caption text NULL,
  locale text NULL,
  attribution text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (content_id, revision_id, media_id),
  CONSTRAINT news_public_content_media_refs_kind_chk
    CHECK (media_kind IN ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER')),
  CONSTRAINT news_public_content_media_refs_url_nonempty
    CHECK (length(trim(url)) > 0),
  CONSTRAINT news_public_content_media_refs_sort_nonneg
    CHECK (sort_order >= 0),
  CONSTRAINT news_public_content_media_refs_content_fk
    FOREIGN KEY (content_id)
    REFERENCES public.news_public_content_items (content_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT news_public_content_media_refs_revision_fk
    FOREIGN KEY (revision_id)
    REFERENCES public.news_public_content_revisions (revision_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
