/**
 * NEWS-02 — Supabase repository adapter tests (fake injected client; no network).
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as news from "../src/features/news-public-content/index.js";
import {
  createFakeSupabaseNewsClient,
  createSupabaseContentRepository,
  domainToItemRow,
  domainToRevisionRow,
  rowsToDomainAggregate,
  mapSupabaseNewsError,
} from "../src/features/news-public-content/persistence/index.js";
import { NEWS_TABLE } from "../src/features/news-public-content/persistence/schema.js";

function sampleContent(overrides = {}) {
  return {
    contentId: "cnt_1",
    contentType: news.CONTENT_TYPE.NEWS,
    contentScope: news.CONTENT_SCOPE.TENANT,
    tenantId: "tenant-1",
    venueId: null,
    clubId: null,
    competitionId: null,
    authorId: "author-1",
    editorialOwnerId: "editor-1",
    title: "Hello News",
    summary: "Summary",
    slug: "hello-news",
    locale: "vi-VN",
    categoryReferences: [
      {
        categoryId: "cat_1",
        slug: "announcements",
        displayLabel: "Announcements",
        locale: "vi-VN",
      },
    ],
    tagReferences: [],
    mediaReferences: [],
    seoMetadata: {
      metaTitle: "Hello",
      metaDescription: "D",
      canonicalPath: "/n/hello-news",
      robots: "INDEX_FOLLOW",
      openGraphImageRef: null,
    },
    banner: null,
    sponsor: null,
    revisionId: "rev_1",
    version: 1,
    editorialStatus: news.EDITORIAL_STATUS.DRAFT,
    review: null,
    approval: null,
    publicationWindow: { publishAt: null, unpublishAt: null, timezone: null },
    publicVisibility: news.PUBLIC_VISIBILITY.PUBLIC,
    provenance: news.CONTENT_PROVENANCE.PREVIEW,
    publishedAt: null,
    unpublishedAt: null,
    archivedAt: null,
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

test("NEWS-02 adapter requires injected client and matches port", () => {
  assert.throws(
    () => createSupabaseContentRepository({}),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT
  );
  const client = createFakeSupabaseNewsClient();
  const repo = createSupabaseContentRepository({ client, preferRpc: false });
  assert.equal(news.matchesContentRepositoryPort(repo), true);
});

test("NEWS-02 adapter maps domain ↔ rows and round-trips via tables", async () => {
  const client = createFakeSupabaseNewsClient();
  const repo = createSupabaseContentRepository({ client, preferRpc: false });
  const content = sampleContent();

  const item = domainToItemRow(content);
  const revision = domainToRevisionRow(content);
  assert.equal(item.row_version, 1);
  assert.equal(revision.slug, "hello-news");

  await repo.save(content);
  const loaded = await repo.getByContentId("cnt_1");
  assert.ok(loaded);
  assert.equal(loaded.title, "Hello News");
  assert.equal(loaded.version, 1);
  assert.equal(loaded.categoryReferences[0].categoryId, "cat_1");
  assert.equal(loaded.provenance, news.CONTENT_PROVENANCE.PREVIEW);
});

test("NEWS-02 adapter OCC: matching version succeeds; stale version rejected", async () => {
  const client = createFakeSupabaseNewsClient();
  const repo = createSupabaseContentRepository({ client, preferRpc: false });
  await repo.save(sampleContent());

  const v2 = sampleContent({
    version: 2,
    revisionId: "rev_2",
    title: "Updated",
    updatedAt: "2026-07-25T01:00:00.000Z",
  });
  await repo.save(v2);
  const loaded = await repo.getByContentId("cnt_1");
  assert.equal(loaded.version, 2);
  assert.equal(loaded.title, "Updated");

  await assert.rejects(
    () =>
      repo.save(
        sampleContent({
          version: 2,
          revisionId: "rev_stale",
          title: "Stale",
          updatedAt: "2026-07-25T02:00:00.000Z",
        })
      ),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT
  );
});

test("NEWS-02 adapter rejects duplicate revision version", async () => {
  const client = createFakeSupabaseNewsClient();
  client.seedRow(NEWS_TABLE.REVISIONS, {
    revision_id: "rev_x",
    content_id: "cnt_dup",
    version: 1,
    content_scope: "TENANT",
    tenant_id: "tenant-1",
    title: "A",
    summary: "",
    slug: "a",
    locale: "vi-VN",
    body_payload: {},
    seo_metadata: {},
    created_by: "a",
    created_at: "2026-07-25T00:00:00.000Z",
  });
  const { error } = await client.from(NEWS_TABLE.REVISIONS).insert({
    revision_id: "rev_y",
    content_id: "cnt_dup",
    version: 1,
    content_scope: "TENANT",
    tenant_id: "tenant-1",
    title: "B",
    summary: "",
    slug: "b",
    locale: "vi-VN",
    body_payload: {},
    seo_metadata: {},
    created_by: "a",
    created_at: "2026-07-25T00:00:00.000Z",
  });
  assert.ok(error);
  const mapped = mapSupabaseNewsError(error, { contentId: "cnt_dup" });
  assert.equal(mapped.code, news.NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT);
});

test("NEWS-02 adapter detectVersionConflict + public RPC mapping", async () => {
  const client = createFakeSupabaseNewsClient({
    rpcResults: {
      news_public_content_query_public: [
        {
          content_id: "cnt_pub",
          content_type: "NEWS",
          content_scope: "TENANT",
          title: "Public",
          summary: "S",
          slug: "public",
          locale: "vi-VN",
          category_references: [],
          tag_references: [],
          media_references: [],
          seo_metadata: {},
          published_at: "2026-07-25T00:00:00.000Z",
          publish_at: null,
          unpublish_at: null,
          publication_timezone: null,
          revision_id: "rev_pub",
          version: 1,
          provenance: "PREVIEW",
          tenant_id: "tenant-1",
          venue_id: null,
          club_id: null,
          competition_id: null,
          banner: null,
          sponsor: null,
        },
      ],
    },
  });
  const repo = createSupabaseContentRepository({ client, preferRpc: true });
  client.seedRow(NEWS_TABLE.ITEMS, {
    content_id: "cnt_v",
    row_version: 3,
    content_type: "NEWS",
    content_scope: "TENANT",
    tenant_id: "tenant-1",
    author_id: "a",
    editorial_owner_id: "e",
    editorial_status: "DRAFT",
    public_visibility: "PUBLIC",
    provenance: "PREVIEW",
    created_at: "2026-07-25T00:00:00.000Z",
    updated_at: "2026-07-25T00:00:00.000Z",
  });

  const conflict = await repo.detectVersionConflict({
    contentId: "cnt_v",
    expectedVersion: 2,
  });
  assert.deepEqual(conflict, {
    contentId: "cnt_v",
    expectedVersion: 2,
    actualVersion: 3,
  });
  assert.equal(
    await repo.detectVersionConflict({ contentId: "cnt_v", expectedVersion: 3 }),
    null
  );

  const publicRows = await repo.queryPublicCandidates({
    now: "2026-07-25T12:00:00.000Z",
  });
  assert.equal(publicRows.length, 1);
  assert.equal(publicRows[0].contentId, "cnt_pub");
  assert.equal(publicRows[0].editorialStatus, "PUBLISHED");
});

test("NEWS-02 adapter maps RLS denial and has no mock fallback", async () => {
  const deniedClient = createFakeSupabaseNewsClient({
    errors: {
      "news_public_content_items:select": {
        code: "42501",
        message: "permission denied for table news_public_content_items",
        status: 403,
      },
    },
  });
  const deniedRepo = createSupabaseContentRepository({
    client: deniedClient,
    preferRpc: false,
  });
  await assert.rejects(
    () => deniedRepo.getByContentId("cnt_x"),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.FORBIDDEN
  );

  const cleanRepo = createSupabaseContentRepository({
    client: createFakeSupabaseNewsClient(),
    preferRpc: false,
  });
  assert.equal(await cleanRepo.getByContentId("missing"), null);
});

test("NEWS-02 approval stale revision rejected on table save path", async () => {
  const client = createFakeSupabaseNewsClient();
  const repo = createSupabaseContentRepository({ client, preferRpc: false });
  await repo.save(sampleContent());
  await assert.rejects(
    () =>
      repo.save(
        sampleContent({
          version: 2,
          revisionId: "rev_2",
          title: "V2",
          updatedAt: "2026-07-25T01:00:00.000Z",
          approval: {
            approverId: "appr-1",
            decision: "APPROVED",
            decidedAt: "2026-07-25T01:00:00.000Z",
            revisionId: "rev_old",
            version: 1,
          },
        })
      ),
    (err) =>
      err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REVISION_MISMATCH
  );
});

test("NEWS-02 rowsToDomainAggregate preserves provenance and version", () => {
  const agg = rowsToDomainAggregate({
    item: {
      content_id: "cnt_1",
      content_type: "NEWS",
      content_scope: "TENANT",
      tenant_id: "tenant-1",
      venue_id: null,
      club_id: null,
      competition_id: null,
      author_id: "a",
      editorial_owner_id: "e",
      editorial_status: "DRAFT",
      public_visibility: "PUBLIC",
      provenance: "LIVE",
      publish_at: null,
      unpublish_at: null,
      publication_timezone: null,
      published_at: null,
      unpublished_at: null,
      archived_at: null,
      row_version: 4,
      created_at: "2026-07-25T00:00:00.000Z",
      updated_at: "2026-07-25T00:00:00.000Z",
    },
    revision: {
      revision_id: "rev_4",
      title: "T",
      summary: "S",
      slug: "t",
      locale: "vi-VN",
      seo_metadata: {},
      banner_payload: null,
      sponsor_payload: null,
    },
  });
  assert.equal(agg.version, 4);
  assert.equal(agg.provenance, "LIVE");
  assert.equal(agg.revisionId, "rev_4");
});
