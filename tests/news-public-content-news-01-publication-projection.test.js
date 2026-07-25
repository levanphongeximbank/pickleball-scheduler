/**
 * NEWS-01 publication eligibility + public projection + provenance.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as news from "../src/features/news-public-content/index.js";
import {
  baseDraftInput,
  createNewsTestDeps,
} from "./support/news-public-content-test-doubles.js";

async function publishPreviewContent(facade, overrides = {}) {
  const draft = await facade.createDraft(baseDraftInput(overrides));
  assert.equal(draft.ok, true);
  let c = draft.value;
  let r = await facade.submitForReview({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  c = r.value;
  r = await facade.approve({
    contentId: c.contentId,
    expectedVersion: c.version,
    approverId: "ap-1",
  });
  c = r.value;
  r = await facade.publish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  return r.value;
}

test("publication eligibility — approved current revision immediate publish", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);
  const published = await publishPreviewContent(facade, { slug: "elig-1" });
  const evalResult = await facade.evaluatePublicationEligibility({
    contentId: published.contentId,
    now: "2026-07-25T10:00:00.000Z",
  });
  assert.equal(evalResult.ok, true);
  assert.equal(evalResult.value.eligible, true);
});

test("publication eligibility — invalid window and non-public visibility", () => {
  assert.throws(
    () =>
      news.createPublicationWindow({
        publishAt: "2026-07-26T00:00:00.000Z",
        unpublishAt: "2026-07-25T00:00:00.000Z",
      }),
    (err) =>
      err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_PUBLICATION_WINDOW
  );

  const draft = news.createDraftContent(
    baseDraftInput({
      slug: "priv-1",
      publicVisibility: news.PUBLIC_VISIBILITY.PRIVATE,
    }),
    {
      contentSeed: "p",
      revisionSeed: "q",
      createdAt: "2026-07-25T00:00:00.000Z",
    }
  );
  const approval = news.createApprovalDecision({
    approverId: "ap-1",
    decision: news.APPROVAL_DECISION.APPROVED,
    decidedAt: "2026-07-25T00:00:00.000Z",
    revisionId: draft.revisionId,
    version: draft.version,
  });
  const approved = {
    ...draft,
    editorialStatus: news.EDITORIAL_STATUS.APPROVED,
    approval,
  };
  const result = news.evaluatePublicationEligibility(approved, {
    now: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("non_public_visibility"));
});

test("publication eligibility — publish after unpublishAt rejected", () => {
  const draft = news.createDraftContent(
    baseDraftInput({
      slug: "win-1",
      publicationWindow: {
        publishAt: "2026-07-20T00:00:00.000Z",
        unpublishAt: "2026-07-24T00:00:00.000Z",
      },
    }),
    {
      contentSeed: "w",
      revisionSeed: "x",
      createdAt: "2026-07-19T00:00:00.000Z",
    }
  );
  const approval = news.createApprovalDecision({
    approverId: "ap-1",
    decision: news.APPROVAL_DECISION.APPROVED,
    decidedAt: "2026-07-19T00:00:00.000Z",
    revisionId: draft.revisionId,
    version: draft.version,
  });
  const approved = {
    ...draft,
    editorialStatus: news.EDITORIAL_STATUS.APPROVED,
    approval,
  };
  const result = news.evaluatePublicationEligibility(approved, {
    now: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("publish_after_unpublish"));
});

test("public projection — eligible published projects; internals not leaked", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);
  const published = await publishPreviewContent(facade, {
    slug: "proj-1",
    categoryReferences: [
      { categoryId: "cat-1", slug: "tin-tuc", displayLabel: "Tin tức" },
    ],
  });

  const projected = await facade.projectPublicContent({
    contentId: published.contentId,
  });
  assert.equal(projected.ok, true);
  assert.equal(projected.value.contentId, published.contentId);
  assert.equal(projected.value.provenance, news.CONTENT_PROVENANCE.PREVIEW);
  assert.equal(projected.value.slug, "proj-1");
  assert.equal("approval" in projected.value, false);
  assert.equal("review" in projected.value, false);
  assert.equal("editorialOwnerId" in projected.value, false);
  assert.equal("authorId" in projected.value, false);
  assert.ok(projected.value.scopeReference);
  assert.equal(projected.value.scopeReference.tenantId, "tenant-1");
});

test("public projection — private / draft / archived rejected", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);
  const draft = await facade.createDraft(baseDraftInput({ slug: "proj-2" }));
  const bad = await facade.projectPublicContent({
    contentId: draft.value.contentId,
  });
  assert.equal(bad.ok, false);
  assert.equal(
    bad.error.code,
    news.NEWS_PUBLIC_CONTENT_ERROR_CODE.CONTENT_NOT_PUBLIC
  );

  const published = await publishPreviewContent(facade, { slug: "proj-3" });
  let r = await facade.archive({
    contentId: published.contentId,
    expectedVersion: published.version,
  });
  assert.equal(r.ok, true);
  r = await facade.projectPublicContent({ contentId: published.contentId });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, news.NEWS_PUBLIC_CONTENT_ERROR_CODE.ARCHIVED_CONTENT);
});

test("provenance — MOCK never projected as LIVE; PREVIEW distinct", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);
  const published = await publishPreviewContent(facade, {
    slug: "mock-1",
    provenance: news.CONTENT_PROVENANCE.MOCK,
  });
  assert.equal(published.provenance, news.CONTENT_PROVENANCE.MOCK);

  const projected = await facade.projectPublicContent({
    contentId: published.contentId,
  });
  assert.equal(projected.ok, true);
  assert.equal(projected.value.provenance, news.CONTENT_PROVENANCE.MOCK);
  assert.notEqual(projected.value.provenance, news.CONTENT_PROVENANCE.LIVE);

  // LIVE projection blocked in NEWS-01 even if somehow present
  assert.throws(
    () =>
      news.projectPublicContent(
        {
          ...published,
          provenance: news.CONTENT_PROVENANCE.LIVE,
        },
        { now: "2026-07-25T10:00:00.000Z", allowLive: false }
      ),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH
  );
});
