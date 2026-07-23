/**
 * Public Player Rating projector (Phase 1I).
 */

import { createPlayerRatingPrivacyPolicy } from "./createPlayerRatingPrivacyPolicy.js";
import { PLAYER_RATING_PRIVACY_PROJECTION_LEVEL } from "./privacyProjectionLevels.js";
import { redactPlayerRatingCandidate } from "./redactPlayerRatingCandidate.js";
import { redactPlayerRatingOverview } from "./redactPlayerRatingOverview.js";

/**
 * Project a candidate or overview to the PUBLIC privacy level.
 *
 * @param {unknown} input
 * @param {{
 *   privacyPolicy?: ReturnType<typeof createPlayerRatingPrivacyPolicy>,
 *   kind?: 'overview'|'candidate',
 * }} [options]
 */
export function projectPublicPlayerRating(input, options = {}) {
  const policy = options.privacyPolicy || createPlayerRatingPrivacyPolicy();
  const level = PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC;

  if (options.kind === "candidate") {
    return redactPlayerRatingCandidate(input, {
      projectionLevel: level,
      privacyPolicy: policy,
    });
  }

  // Default: treat as overview DTO when it looks like one; else candidate.
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
