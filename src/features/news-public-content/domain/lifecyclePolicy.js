/**
 * Deterministic editorial lifecycle policy (NEWS-01).
 */

import {
  EDITORIAL_STATUS,
  isEditorialStatus,
  isEditorialTransitionAllowed,
} from "../constants/editorialLifecycle.js";
import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  APPROVAL_DECISION,
  isApprovalBoundToRevision,
} from "../contracts/approvalDecision.js";
import { clonePlain, deepFreeze, failContract } from "../contracts/shared.js";
import { evaluatePublicationEligibility } from "./publicationEligibility.js";

/**
 * @param {string} from
 * @param {string} to
 */
export function assertLifecycleTransition(from, to) {
  if (!isEditorialStatus(from) || !isEditorialStatus(to)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LIFECYCLE_TRANSITION,
      "Unknown editorial status in transition",
      { from, to }
    );
  }
  if (from === EDITORIAL_STATUS.ARCHIVED) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.ARCHIVED_CONTENT,
      "ARCHIVED is terminal; no further transitions",
      { from, to }
    );
  }
  if (!isEditorialTransitionAllowed(from, to)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LIFECYCLE_TRANSITION,
      `Transition not allowed: ${from} → ${to}`,
      { from, to }
    );
  }
}

/**
 * Apply a lifecycle transition with policy guards.
 *
 * @param {Record<string, unknown>} content
 * @param {string} toStatus
 * @param {{
 *   now: string,
 *   review?: Record<string, unknown>|null,
 *   approval?: Record<string, unknown>|null,
 *   publicationWindow?: Record<string, unknown>|null,
 *   updatedAt?: string,
 * }} ctx
 */
export function applyLifecycleTransition(content, toStatus, ctx) {
  const from = /** @type {string} */ (content.editorialStatus);
  assertLifecycleTransition(from, toStatus);

  const next = clonePlain(content);
  const now = ctx.now;
  const updatedAt = ctx.updatedAt || now;

  if (toStatus === EDITORIAL_STATUS.IN_REVIEW) {
    // draft → in_review
  }

  if (toStatus === EDITORIAL_STATUS.DRAFT && from === EDITORIAL_STATUS.IN_REVIEW) {
    if (!ctx.review) {
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.REVIEW_REQUIRED,
        "Request-changes transition requires a review decision",
        { from, to: toStatus }
      );
    }
    next.review = ctx.review;
  }

  if (toStatus === EDITORIAL_STATUS.APPROVED) {
    if (from === EDITORIAL_STATUS.IN_REVIEW) {
      if (!ctx.approval) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REQUIRED,
          "IN_REVIEW → APPROVED requires a valid approval decision",
          { from, to: toStatus }
        );
      }
      if (
        !isApprovalBoundToRevision(ctx.approval, {
          revisionId: /** @type {string} */ (content.revisionId),
          version: /** @type {number} */ (content.version),
        })
      ) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REVISION_MISMATCH,
          "Approval must bind to the current revision/version",
          {
            approvalRevisionId: ctx.approval.revisionId,
            approvalVersion: ctx.approval.version,
            contentRevisionId: content.revisionId,
            contentVersion: content.version,
          }
        );
      }
      if (ctx.approval.decision !== APPROVAL_DECISION.APPROVED) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REQUIRED,
          "Approval decision must be APPROVED",
          { decision: ctx.approval.decision }
        );
      }
      next.approval = ctx.approval;
      if (ctx.review) next.review = ctx.review;
    }

    if (from === EDITORIAL_STATUS.SCHEDULED) {
      // cancel schedule — keep existing approval
    }

    if (from === EDITORIAL_STATUS.UNPUBLISHED) {
      if (
        !isApprovalBoundToRevision(content.approval, {
          revisionId: /** @type {string} */ (content.revisionId),
          version: /** @type {number} */ (content.version),
        })
      ) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REQUIRED,
          "UNPUBLISHED → APPROVED requires current-revision approval still valid",
          { revisionId: content.revisionId, version: content.version }
        );
      }
    }
  }

  if (toStatus === EDITORIAL_STATUS.SCHEDULED) {
    const window = ctx.publicationWindow || content.publicationWindow;
    if (!window || !window.publishAt) {
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_PUBLICATION_WINDOW,
        "SCHEDULED requires a valid future publication window with publishAt",
        { publicationWindow: window }
      );
    }
    const publishMs = Date.parse(String(window.publishAt));
    const nowMs = Date.parse(now);
    if (!(publishMs > nowMs)) {
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_PUBLICATION_WINDOW,
        "SCHEDULED publishAt must be strictly in the future relative to now",
        { publishAt: window.publishAt, now }
      );
    }
    next.publicationWindow = window;
  }

  if (toStatus === EDITORIAL_STATUS.PUBLISHED) {
    const candidate = {
      ...next,
      editorialStatus: EDITORIAL_STATUS.APPROVED,
      publicationWindow: ctx.publicationWindow || next.publicationWindow,
    };
    // Temporary status for eligibility: treat as approved/scheduled candidate
    if (from === EDITORIAL_STATUS.SCHEDULED || from === EDITORIAL_STATUS.APPROVED) {
      candidate.editorialStatus = from;
    }
    if (from === EDITORIAL_STATUS.UNPUBLISHED) {
      candidate.editorialStatus = EDITORIAL_STATUS.UNPUBLISHED;
    }
    const eligibility = evaluatePublicationEligibility(candidate, { now });
    if (!eligibility.eligible) {
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.PUBLICATION_NOT_ELIGIBLE,
        eligibility.reason || "Content is not eligible for publication",
        { reasons: eligibility.reasons, reason: eligibility.reason }
      );
    }
    if (ctx.publicationWindow) {
      next.publicationWindow = ctx.publicationWindow;
    }
    next.publishedAt = now;
  }

  if (toStatus === EDITORIAL_STATUS.UNPUBLISHED) {
    next.unpublishedAt = now;
  }

  if (toStatus === EDITORIAL_STATUS.ARCHIVED) {
    next.archivedAt = now;
  }

  if (toStatus === EDITORIAL_STATUS.DRAFT && from === EDITORIAL_STATUS.UNPUBLISHED) {
    // reopen for new editorial revision path; approval cleared on createRevision
  }

  next.editorialStatus = toStatus;
  next.updatedAt = updatedAt;
  return deepFreeze(next);
}
