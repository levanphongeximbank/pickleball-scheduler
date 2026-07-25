/**
 * NEWS-01 foundation — identity, field validation, facade, exports.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as news from "../src/features/news-public-content/index.js";
import {
  baseDraftInput,
  createNewsTestDeps,
} from "./support/news-public-content-test-doubles.js";

test("NEWS-01 public export allowlist is stable", () => {
  for (const name of news.NEWS_PUBLIC_CONTENT_PUBLIC_EXPORTS) {
    assert.equal(name in news, true, `missing public export: ${name}`);
  }
  assert.ok(
    ["NEWS-01", "NEWS-02", "NEWS-03", "NEWS-04"].includes(
      news.NEWS_PUBLIC_CONTENT_PHASE.id
    ),
    "phase id must remain a News workstream id"
  );
  assert.equal(news.newsPublicContentFacade, news.createNewsPublicContentFacade);
});

test("content identity and field validation — valid draft", () => {
  const draft = news.createDraftContent(baseDraftInput(), {
    contentSeed: "a",
    revisionSeed: "b",
    createdAt: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(draft.editorialStatus, news.EDITORIAL_STATUS.DRAFT);
  assert.equal(draft.version, 1);
  assert.ok(draft.contentId);
  assert.ok(draft.revisionId);
  assert.equal(draft.tenantId, "tenant-1");
});

test("invalid content id / type / scope / slug / locale fail closed", () => {
  assert.throws(
    () => news.requireOpaqueId("", "contentId"),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_IDENTITY
  );
  assert.throws(
    () =>
      news.createDraftContent(baseDraftInput({ contentType: "BLOG" }), {
        contentSeed: "a",
        revisionSeed: "b",
        createdAt: "2026-07-25T00:00:00.000Z",
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.UNSUPPORTED_CONTENT_TYPE
  );
  assert.throws(
    () =>
      news.createDraftContent(baseDraftInput({ contentScope: "WORLD" }), {
        contentSeed: "a",
        revisionSeed: "b",
        createdAt: "2026-07-25T00:00:00.000Z",
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.UNSUPPORTED_CONTENT_SCOPE
  );
  assert.throws(
    () =>
      news.createDraftContent(baseDraftInput({ slug: "Bad Slug!" }), {
        contentSeed: "a",
        revisionSeed: "b",
        createdAt: "2026-07-25T00:00:00.000Z",
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_SLUG
  );
  assert.throws(
    () =>
      news.createDraftContent(baseDraftInput({ locale: "vietnamese" }), {
        contentSeed: "a",
        revisionSeed: "b",
        createdAt: "2026-07-25T00:00:00.000Z",
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LOCALE
  );
});

test("scope ownership requires identities; PLATFORM does not", () => {
  const platform = news.validateScopeOwnership(news.CONTENT_SCOPE.PLATFORM, {});
  assert.equal(platform.tenantId, null);

  assert.throws(
    () => news.validateScopeOwnership(news.CONTENT_SCOPE.TENANT, {}),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER
  );
  assert.throws(
    () =>
      news.validateScopeOwnership(news.CONTENT_SCOPE.VENUE, {
        venueId: "v1",
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER
  );
  assert.throws(
    () =>
      news.validateScopeOwnership(news.CONTENT_SCOPE.CLUB, {
        clubId: "c1",
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER
  );
  assert.throws(
    () =>
      news.validateScopeOwnership(news.CONTENT_SCOPE.COMPETITION, {
        competitionId: "comp1",
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER
  );

  const venue = news.validateScopeOwnership(news.CONTENT_SCOPE.VENUE, {
    tenantId: "t1",
    venueId: "v1",
  });
  assert.equal(venue.venueId, "v1");
  assert.equal(venue.tenantId, "t1");
});

test("LIVE provenance rejected for NEWS-01 drafts; MOCK/PREVIEW allowed", () => {
  assert.throws(
    () =>
      news.createDraftContent(
        baseDraftInput({ provenance: news.CONTENT_PROVENANCE.LIVE }),
        {
          contentSeed: "a",
          revisionSeed: "b",
          createdAt: "2026-07-25T00:00:00.000Z",
        }
      ),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH
  );

  const mockDraft = news.createDraftContent(
    baseDraftInput({ provenance: news.CONTENT_PROVENANCE.MOCK }),
    {
      contentSeed: "m",
      revisionSeed: "n",
      createdAt: "2026-07-25T00:00:00.000Z",
    }
  );
  assert.equal(mockDraft.provenance, news.CONTENT_PROVENANCE.MOCK);
});

test("category/tag/media/SEO reference contracts validate", () => {
  const category = news.createCategoryReference({
    categoryId: "cat-1",
    slug: "tin-tuc",
    displayLabel: "Tin tức",
    locale: "vi",
  });
  assert.equal(category.categoryId, "cat-1");

  const tag = news.createTagReference({
    tagId: "tag-1",
    slug: "open",
    label: "Open",
  });
  assert.equal(tag.tagId, "tag-1");

  const media = news.createMediaReference({
    mediaId: "media-1",
    mediaKind: news.MEDIA_KIND.IMAGE,
    url: "https://cdn.example/x.jpg",
    altText: "Court",
  });
  assert.equal(media.mediaKind, "IMAGE");

  const seo = news.createSeoMetadata({
    metaTitle: "Title",
    metaDescription: "Desc",
    canonicalPath: "/news/x",
    robots: news.SEO_ROBOTS.INDEX_FOLLOW,
  });
  assert.equal(seo.metaTitle, "Title");
});

test("facade createDraft returns typed ok result and persists via port", async () => {
  const deps = createNewsTestDeps();
  const facade = news.createNewsPublicContentFacade(deps);
  const result = await facade.createDraft(baseDraftInput());
  assert.equal(result.ok, true);
  assert.equal(result.value.editorialStatus, news.EDITORIAL_STATUS.DRAFT);
  assert.equal(result.value.provenance, news.CONTENT_PROVENANCE.PREVIEW);

  const loaded = await facade.getByContentId({
    contentId: result.value.contentId,
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.value.contentId, result.value.contentId);
});

test("facade does not depend on mockPublicData as SoT", async () => {
  const deps = createNewsTestDeps();
  const facade = news.createNewsPublicContentFacade(deps);
  const result = await facade.createDraft(baseDraftInput({ slug: "domain-only" }));
  assert.equal(result.ok, true);
  assert.notEqual(result.value.contentId, "n1");
  assert.equal(result.value.slug, "domain-only");
});

test("Platform adoption surface is ready", () => {
  const surface = news.assertNewsPlatformSurface();
  assert.equal(surface.ready, true);
  const actor = news.projectNewsActor({ actorId: "u1", actorType: "USER" });
  assert.equal(actor.ok, true);
  const scope = news.projectNewsTenantScope({ tenantId: "t1" });
  assert.equal(scope.ok, true);
});
