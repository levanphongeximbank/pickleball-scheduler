/**
 * Revision / version rules (NEWS-01). Deterministic; no silent mutation of approved/published revisions.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { createRevisionId, requireOpaqueId } from "../contracts/identifiers.js";

/**
 * @param {number} version
 * @returns {number}
 */
export function assertPositiveVersion(version) {
  const n = Number(version);
  if (!Number.isInteger(n) || n < 1) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_REVISION_VERSION,
      "version must be a positive integer",
      { field: "version", value: version }
    );
  }
  return n;
}

/**
 * @param {{ version: number, revisionId: string }} current
 * @param {number} expectedVersion
 */
export function assertVersionMatch(current, expectedVersion) {
  const expected = assertPositiveVersion(expectedVersion);
  if (current.version !== expected) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
      "Content version conflict",
      {
        expectedVersion: expected,
        actualVersion: current.version,
        revisionId: current.revisionId,
      }
    );
  }
}

/**
 * Create a new revision from an existing content body. Invalidates prior approval.
 *
 * @param {Record<string, unknown>} content
 * @param {Record<string, unknown>} patch
 * @param {{ revisionSeed: string, updatedAt: string }} ctx
 */
export function createContentRevision(content, patch, ctx) {
  const revisionSeed = requireNonEmptyString(ctx.revisionSeed, "revisionSeed");
  const updatedAt = requireNonEmptyString(ctx.updatedAt, "updatedAt");
  const nextVersion = assertPositiveVersion(content.version) + 1;
  const revisionId = createRevisionId(revisionSeed);

  const next = clonePlain(content);
  const allowedFields = [
    "title",
    "summary",
    "slug",
    "locale",
    "categoryReferences",
    "tagReferences",
    "mediaReferences",
    "seoMetadata",
    "banner",
    "sponsor",
    "publicationWindow",
    "publicVisibility",
  ];
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key];
    }
  }

  next.version = nextVersion;
  next.revisionId = revisionId;
  next.updatedAt = updatedAt;
  next.approval = null;
  next.review = null;
  // New revision of published/approved content returns to draft for editorial.
  // Caller lifecycle policy decides transitions separately when editing unpublished.

  return deepFreeze(next);
}

/**
 * @param {unknown} revisionId
 * @returns {string}
 */
export function requireRevisionId(revisionId) {
  return requireOpaqueId(revisionId, "revisionId");
}
