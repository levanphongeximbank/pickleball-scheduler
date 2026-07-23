/**
 * Restricted / internal Player Rating projector (Phase 1I).
 * Covers PLAYER_SELF, AUTHORIZED_REVIEWER, and INTERNAL_SYSTEM.
 */

import { createPlayerRatingPrivacyPolicy } from "./createPlayerRatingPrivacyPolicy.js";
import {
  PLAYER_RATING_PRIVACY_PROJECTION_LEVEL,
  isSupportedPrivacyProjectionLevel,
} from "./privacyProjectionLevels.js";
import { redactPlayerRatingCandidate } from "./redactPlayerRatingCandidate.js";
import { redactPlayerRatingOverview } from "./redactPlayerRatingOverview.js";
import {
  PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE,
  failSecurityPrivacy,
} from "./securityPrivacyErrors.js";

/**
 * @param {unknown} input
 * @param {{
 *   projectionLevel: string,
 *   privacyPolicy?: ReturnType<typeof createPlayerRatingPrivacyPolicy>,
 *   kind?: 'overview'|'candidate',
 * }} options
 */
export function projectRestrictedPlayerRating(input, options) {
  if (!options || typeof options !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "projectRestrictedPlayerRating requires options"
    );
  }

  const level = String(options.projectionLevel);
  if (!isSupportedPrivacyProjectionLevel(level)) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED,
      "Unsupported restricted projection level",
      { projectionLevel: level }
    );
  }

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED,
      "Use projectPublicPlayerRating for PUBLIC projections",
      { projectionLevel: level }
    );
  }

  const policy = options.privacyPolicy || createPlayerRatingPrivacyPolicy();

  if (options.kind === "candidate") {
    return redactPlayerRatingCandidate(input, {
      projectionLevel: level,
      privacyPolicy: policy,
    });
  }

  if (
    input &&
    typeof input === "object" &&
    (Array.isArray(/** @type {{ candidates?: unknown }} */ (input).candidates) ||
      "availabilityStatus" in /** @type {object} */ (input))
  ) {
    return redactPlayerRatingOverview(input, {
      projectionLevel: level,
      privacyPolicy: policy,
    });
  }

  return redactPlayerRatingCandidate(input, {
    projectionLevel: level,
    privacyPolicy: policy,
  });
}
