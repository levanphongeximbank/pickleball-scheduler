/**
 * Review decision contract (NEWS-01).
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { requireOpaqueId } from "./identifiers.js";

export const REVIEW_DECISION = Object.freeze({
  REQUEST_CHANGES: "REQUEST_CHANGES",
  APPROVE_FOR_EDITORIAL: "APPROVE_FOR_EDITORIAL",
});

export const REVIEW_DECISION_VALUES = Object.freeze(
  Object.values(REVIEW_DECISION)
);

/**
 * @param {Record<string, unknown>} input
 */
export function createReviewDecision(input = {}) {
  const reviewerId = requireOpaqueId(input.reviewerId, "reviewerId");
  const decision = requireNonEmptyString(input.decision, "decision");
  if (!REVIEW_DECISION_VALUES.includes(decision)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "Unsupported review decision",
      { field: "decision", value: decision }
    );
  }
  const decidedAt = requireIsoInstant(input.decidedAt, "decidedAt");
  const reason = optionalNonEmptyString(input.reason ?? input.comment, "reason");
  const revisionId = requireOpaqueId(input.revisionId, "revisionId");
  const version = Number(input.version);
  if (!Number.isInteger(version) || version < 1) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_REVISION_VERSION,
      "Review decision requires positive integer version",
      { field: "version", value: input.version }
    );
  }

  return deepFreeze({
    reviewerId,
    decision,
    decidedAt,
    reason,
    revisionId,
    version,
  });
}
