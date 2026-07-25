/**
 * Deterministic publication eligibility policy (NEWS-01).
 * Time is always provided via `now` — no system clock inside domain.
 */

import { CONTENT_TYPE, isContentType } from "../constants/contentTypes.js";
import { isContentScope } from "../constants/contentScopes.js";
import { EDITORIAL_STATUS } from "../constants/editorialLifecycle.js";
import {
  isPubliclyReadableVisibility,
  isPublicVisibility,
} from "../constants/publicVisibility.js";
import { isApprovalBoundToRevision } from "../contracts/approvalDecision.js";
import {
  evaluatePublicationWindow,
  createPublicationWindow,
} from "../contracts/publicationWindow.js";
import {
  isNonEmptyString,
  isValidLocale,
  isValidSlug,
} from "../contracts/shared.js";
import { validateScopeOwnership } from "./scopeOwnership.js";
import { assertPositiveVersion } from "./revisionVersion.js";

/**
 * @typedef {{
 *   eligible: boolean,
 *   reason?: string,
 *   reasons: string[],
 * }} PublicationEligibilityResult
 */

/**
 * @param {Record<string, unknown>} content
 * @param {{ now: string }} ctx
 * @returns {PublicationEligibilityResult}
 */
export function evaluatePublicationEligibility(content, ctx) {
  /** @type {string[]} */
  const reasons = [];

  if (!content || typeof content !== "object") {
    return fail("invalid_content");
  }

  if (!isNonEmptyString(content.contentId)) {
    reasons.push("invalid_content_identity");
  }
  if (!isContentType(content.contentType)) {
    reasons.push("unsupported_content_type");
  }
  if (!isContentScope(content.contentScope)) {
    reasons.push("unsupported_content_scope");
  } else {
    try {
      validateScopeOwnership(/** @type {string} */ (content.contentScope), {
        tenantId: content.tenantId,
        venueId: content.venueId,
        clubId: content.clubId,
        competitionId: content.competitionId,
      });
    } catch {
      reasons.push("missing_scope_owner");
    }
  }

  if (!isNonEmptyString(content.title)) {
    reasons.push("empty_title");
  }
  if (!isValidSlug(content.slug)) {
    reasons.push("invalid_slug");
  }
  if (!isValidLocale(content.locale)) {
    reasons.push("invalid_locale");
  }

  // Summary policy: required non-empty for editorial content types; optional empty for BANNER.
  const summaryRequired =
    content.contentType !== CONTENT_TYPE.BANNER &&
    content.contentType !== CONTENT_TYPE.SPONSOR_CONTENT;
  if (summaryRequired && !isNonEmptyString(content.summary)) {
    reasons.push("empty_summary");
  }

  try {
    assertPositiveVersion(content.version);
  } catch {
    reasons.push("invalid_revision_version");
  }
  if (!isNonEmptyString(content.revisionId)) {
    reasons.push("invalid_revision_id");
  }

  if (content.editorialStatus === EDITORIAL_STATUS.ARCHIVED) {
    reasons.push("archived_content");
  }

  if (
    !isApprovalBoundToRevision(content.approval, {
      revisionId: /** @type {string} */ (content.revisionId),
      version: /** @type {number} */ (content.version),
    })
  ) {
    reasons.push("approval_revision_mismatch");
  }

  if (!isPublicVisibility(content.publicVisibility)) {
    reasons.push("invalid_public_visibility");
  } else if (!isPubliclyReadableVisibility(content.publicVisibility)) {
    reasons.push("non_public_visibility");
  }

  let window = content.publicationWindow;
  if (window && typeof window === "object") {
    try {
      window = createPublicationWindow(/** @type {Record<string, unknown>} */ (window));
    } catch {
      reasons.push("invalid_publication_window");
      window = null;
    }
  } else {
    window = { publishAt: null, unpublishAt: null, timezone: null };
  }

  // Immediate publish allowed when window has no publishAt (publish now) OR publishAt <= now.
  // Scheduled publish path requires publishAt in the past or equal relative to provided now.
  if (window && !reasons.includes("invalid_publication_window")) {
    if (
      content.editorialStatus === EDITORIAL_STATUS.SCHEDULED &&
      !window.publishAt
    ) {
      reasons.push("scheduled_missing_publish_at");
    }
    const windowEval = evaluatePublicationWindow(
      /** @type {{ publishAt: string|null, unpublishAt: string|null, timezone: string|null }} */ (
        window
      ),
      ctx.now
    );
    if (!windowEval.ok) {
      if (windowEval.reason === "before_publish_at") {
        reasons.push("publish_too_early");
      } else if (windowEval.reason === "after_unpublish_at") {
        reasons.push("publish_after_unpublish");
      } else if (windowEval.reason === "invalid_now") {
        reasons.push("invalid_now");
      } else {
        reasons.push("invalid_publication_window");
      }
    }
  }

  // Allowed source statuses for publish eligibility evaluation
  const allowedStatuses = [
    EDITORIAL_STATUS.APPROVED,
    EDITORIAL_STATUS.SCHEDULED,
    EDITORIAL_STATUS.UNPUBLISHED,
    EDITORIAL_STATUS.PUBLISHED,
  ];
  if (!allowedStatuses.includes(/** @type {string} */ (content.editorialStatus))) {
    reasons.push("editorial_status_not_publishable");
  }

  // Type-specific reference constraints (minimal NEWS-01)
  if (content.contentType === CONTENT_TYPE.BANNER && !content.banner) {
    reasons.push("banner_contract_required");
  }
  if (content.contentType === CONTENT_TYPE.SPONSOR_CONTENT && !content.sponsor) {
    reasons.push("sponsor_contract_required");
  }

  if (reasons.length > 0) {
    return {
      eligible: false,
      reason: reasons[0],
      reasons: Object.freeze([...reasons]),
    };
  }

  return {
    eligible: true,
    reasons: Object.freeze([]),
  };
}

/**
 * @param {string} reason
 * @returns {PublicationEligibilityResult}
 */
function fail(reason) {
  return {
    eligible: false,
    reason,
    reasons: Object.freeze([reason]),
  };
}
