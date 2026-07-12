import { RELIABILITY_THRESHOLDS } from "../constants/reliabilityConfig.js";
import { V5_RATING_STATUS } from "../constants/ratingStatus.js";

/**
 * Resolves which rating track to display — never multiplies rating by reliability.
 */
export function resolveDisplayRating({
  verifiedRatingMean = null,
  openRatingMean = null,
  provisionalRating = null,
  reliabilityScore = 0,
  ratingStatus = V5_RATING_STATUS.NOT_ASSESSED,
}) {
  const reliability = Number(reliabilityScore) || 0;
  const verified = Number(verifiedRatingMean);
  const open = Number(openRatingMean);
  const provisional = Number(provisionalRating);

  if (
    Number.isFinite(verified)
    && reliability >= RELIABILITY_THRESHOLDS.verifiedDisplayMin
    && ratingStatus !== V5_RATING_STATUS.SUSPENDED
  ) {
    return {
      displaySource: "verified_match_rating",
      ratingMean: verified,
      badge: V5_RATING_STATUS.VERIFIED,
    };
  }

  if (Number.isFinite(open) && open > 0) {
    return {
      displaySource: "open_match_rating",
      ratingMean: open,
      badge: ratingStatus === V5_RATING_STATUS.PROJECTED
        ? V5_RATING_STATUS.PROJECTED
        : V5_RATING_STATUS.MATCH_CALIBRATED,
    };
  }

  if (Number.isFinite(provisional)) {
    return {
      displaySource: "provisional_rating",
      ratingMean: provisional,
      badge: ratingStatus === V5_RATING_STATUS.SELF_ASSESSED
        ? V5_RATING_STATUS.SELF_ASSESSED
        : V5_RATING_STATUS.PROVISIONAL,
    };
  }

  return {
    displaySource: "none",
    ratingMean: null,
    badge: V5_RATING_STATUS.NOT_ASSESSED,
  };
}
