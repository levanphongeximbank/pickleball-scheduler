/**
 * NEWS-01 lifecycle matrix + revision/version + approval binding.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as news from "../src/features/news-public-content/index.js";
import {
  baseDraftInput,
  createNewsTestDeps,
} from "./support/news-public-content-test-doubles.js";

/**
 * @param {*} facade
 * @param {Record<string, unknown>} [overrides]
 */
async function createApprovedContent(facade, overrides = {}) {
  const draft = await facade.createDraft(baseDraftInput(overrides));
  assert.equal(draft.ok, true);
  let c = draft.value;

  let r = await facade.submitForReview({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  c = r.value;

  r = await facade.approve({
    contentId: c.contentId,
    expectedVersion: c.version,
    approverId: "approver-1",
  });
  assert.equal(r.ok, true);
  return r.value;
}

test("lifecycle — allowed transitions including archive terminal", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);

  let draft = await facade.createDraft(baseDraftInput({ slug: "life-1" }));
  assert.equal(draft.ok, true);
  let c = draft.value;

  let r = await facade.submitForReview({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.IN_REVIEW);

  r = await facade.requestChanges({
    contentId: c.contentId,
    expectedVersion: c.version,
    reviewerId: "rev-1",
    reason: "Fix title",
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.DRAFT);
  assert.equal(r.value.review.decision, "REQUEST_CHANGES");

  c = r.value;
  r = await facade.submitForReview({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  c = r.value;

  r = await facade.approve({
    contentId: c.contentId,
    expectedVersion: c.version,
    approverId: "ap-1",
  });
  assert.equal(r.ok, true);
  c = r.value;
  assert.equal(c.editorialStatus, news.EDITORIAL_STATUS.APPROVED);

  r = await facade.schedule({
    contentId: c.contentId,
    expectedVersion: c.version,
    publicationWindow: {
      publishAt: "2026-07-26T00:00:00.000Z",
      unpublishAt: "2026-08-01T00:00:00.000Z",
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.SCHEDULED);
  c = r.value;

  r = await facade.cancelSchedule({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.APPROVED);
  c = r.value;

  // Immediate publish: clear future window left from schedule, or wait until publishAt.
  r = await facade.publish({
    contentId: c.contentId,
    expectedVersion: c.version,
    publicationWindow: { publishAt: null, unpublishAt: null },
    now: "2026-07-25T10:00:00.000Z",
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.PUBLISHED);
  c = r.value;

  r = await facade.unpublish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.UNPUBLISHED);
  c = r.value;

  r = await facade.restoreApproved({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.APPROVED);
  c = r.value;

  r = await facade.publish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  c = r.value;

  r = await facade.archive({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.ARCHIVED);

  r = await facade.unpublish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, false);
  assert.equal(
    r.error.code,
    news.NEWS_PUBLIC_CONTENT_ERROR_CODE.ARCHIVED_CONTENT
  );
});

test("lifecycle — UNPUBLISHED → DRAFT and UNPUBLISHED → PUBLISHED", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);
  let c = await createApprovedContent(facade, { slug: "life-2" });

  let r = await facade.publish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  c = r.value;

  r = await facade.unpublish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  c = r.value;

  r = await facade.publish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.PUBLISHED);
  c = r.value;

  r = await facade.unpublish({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  c = r.value;

  const reopened = news.applyLifecycleTransition(
    c,
    news.EDITORIAL_STATUS.DRAFT,
    { now: "2026-07-25T11:00:00.000Z" }
  );
  assert.equal(reopened.editorialStatus, news.EDITORIAL_STATUS.DRAFT);
});

test("forbidden transitions fail with typed error", () => {
  assert.throws(
    () =>
      news.assertLifecycleTransition(
        news.EDITORIAL_STATUS.DRAFT,
        news.EDITORIAL_STATUS.PUBLISHED
      ),
    (err) =>
      err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LIFECYCLE_TRANSITION
  );
  assert.throws(
    () =>
      news.assertLifecycleTransition(
        news.EDITORIAL_STATUS.ARCHIVED,
        news.EDITORIAL_STATUS.DRAFT
      ),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.ARCHIVED_CONTENT
  );
});

test("approval bound to revision; stale approval invalid after new revision", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);
  let c = await createApprovedContent(facade, { slug: "rev-1" });
  const approvedRevision = c.revisionId;
  const approvedVersion = c.version;

  let r = await facade.createRevision({
    contentId: c.contentId,
    expectedVersion: c.version,
    patch: { title: "New title after approval" },
  });
  assert.equal(r.ok, true);
  c = r.value;
  assert.equal(c.version, approvedVersion + 1);
  assert.notEqual(c.revisionId, approvedRevision);
  assert.equal(c.approval, null);
  assert.equal(c.editorialStatus, news.EDITORIAL_STATUS.DRAFT);

  r = await facade.submitForReview({
    contentId: c.contentId,
    expectedVersion: c.version,
  });
  assert.equal(r.ok, true);
  c = r.value;

  const staleApproval = news.createApprovalDecision({
    approverId: "ap-1",
    decision: news.APPROVAL_DECISION.APPROVED,
    decidedAt: "2026-07-25T10:00:00.000Z",
    revisionId: approvedRevision,
    version: approvedVersion,
  });
  assert.throws(
    () =>
      news.applyLifecycleTransition(c, news.EDITORIAL_STATUS.APPROVED, {
        now: "2026-07-25T10:05:00.000Z",
        approval: staleApproval,
      }),
    (err) =>
      err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REVISION_MISMATCH
  );

  r = await facade.approve({
    contentId: c.contentId,
    expectedVersion: approvedVersion,
    approverId: "ap-1",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, news.NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT);
});

test("scheduled publish at provided now; too-early rejected", async () => {
  const deps = createNewsTestDeps("2026-07-25T10:00:00.000Z");
  const facade = news.createNewsPublicContentFacade(deps);
  let c = await createApprovedContent(facade, { slug: "sched-1" });

  let r = await facade.schedule({
    contentId: c.contentId,
    expectedVersion: c.version,
    publicationWindow: { publishAt: "2026-07-26T00:00:00.000Z" },
  });
  assert.equal(r.ok, true);
  c = r.value;

  r = await facade.publish({
    contentId: c.contentId,
    expectedVersion: c.version,
    now: "2026-07-25T12:00:00.000Z",
  });
  assert.equal(r.ok, false);
  assert.equal(
    r.error.code,
    news.NEWS_PUBLIC_CONTENT_ERROR_CODE.PUBLICATION_NOT_ELIGIBLE
  );

  r = await facade.publish({
    contentId: c.contentId,
    expectedVersion: c.version,
    now: "2026-07-26T00:00:00.000Z",
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.editorialStatus, news.EDITORIAL_STATUS.PUBLISHED);
});
