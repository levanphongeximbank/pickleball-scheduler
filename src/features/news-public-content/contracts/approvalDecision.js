/**
 * Approval decision contract (NEWS-01).
 * Approval is bound to a specific revision/version and does not imply published.
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

export const APPROVAL_DECISION = Object.freeze({
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export const APPROVAL_DECISION_VALUES = Object.freeze(
  Object.values(APPROVAL_DECISION)
);

/**
 * @param {Record<string, unknown>} input
 */
export function createApprovalDecision(input = {}) {
  const approverId = requireOpaqueId(input.approverId, "approverId");
  const decision = requireNonEmptyString(input.decision, "decision");
  if (!APPROVAL_DECISION_VALUES.includes(decision)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "Unsupported approval decision",
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
      "Approval decision requires positive integer version",
      { field: "version", value: input.version }
    );
  }

  return deepFreeze({
    approverId,
    decision,
    decidedAt,
    reason,
    revisionId,
    version,
  });
}

/**
 * @param {{ revisionId: string, version: number }|null|undefined} approval
 * @param {{ revisionId: string, version: number }} revision
 * @returns {boolean}
 */
export function isApprovalBoundToRevision(approval, revision) {
  if (!approval || !revision) return false;
  if (approval.decision !== APPROVAL_DECISION.APPROVED) return false;
  return (
    approval.revisionId === revision.revisionId &&
    approval.version === revision.version
  );
}
