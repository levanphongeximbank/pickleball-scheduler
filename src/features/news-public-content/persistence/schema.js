/**
 * NEWS-02 — Durable table / RPC name constants.
 * Do not expose raw table names from the public module barrel unless needed.
 */

export const NEWS_TABLE = Object.freeze({
  ITEMS: "news_public_content_items",
  REVISIONS: "news_public_content_revisions",
  REVIEWS: "news_public_content_reviews",
  APPROVALS: "news_public_content_approvals",
  CATEGORY_REFS: "news_public_content_category_refs",
  TAG_REFS: "news_public_content_tag_refs",
  MEDIA_REFS: "news_public_content_media_refs",
});

export const NEWS_TABLE_NAME_VALUES = Object.freeze(Object.values(NEWS_TABLE));

export const NEWS_RPC = Object.freeze({
  SAVE_AGGREGATE: "news_public_content_save_aggregate",
  QUERY_PUBLIC: "news_public_content_query_public",
});

export const NEWS_SQL_PACKAGE_DIR = "docs/news-public-content/news-02";

export const NEWS_SQL_PACKAGE_FILES = Object.freeze([
  "10_NEWS_PHASE_02_TABLES.sql",
  "20_NEWS_PHASE_02_INDEXES.sql",
  "30_NEWS_PHASE_02_RLS.sql",
  "40_NEWS_PHASE_02_SAVE_RPC.sql",
  "50_NEWS_PHASE_02_GRANTS.sql",
  "60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql",
  "90_NEWS_PHASE_02_ROLLBACK.sql",
  "99_NEWS_PHASE_02_VERIFICATION.sql",
]);
