/** @typedef {import('../types/ratingEligibilityStatus.js').RatingEligibilityStatusValue} RatingEligibilityStatusValue */

export const RATING_ELIGIBILITY_STATUS = Object.freeze({
  ELIGIBLE: "eligible",
  INELIGIBLE: "ineligible",
  REQUIRES_REVIEW: "requires_review",
});

/** @type {ReadonlySet<RatingEligibilityStatusValue>} */
export const RATING_ELIGIBILITY_STATUS_VALUES = new Set(Object.values(RATING_ELIGIBILITY_STATUS));

/**
 * @param {unknown} value
 * @returns {value is RatingEligibilityStatusValue}
 */
export function isRatingEligibilityStatus(value) {
  return (
    typeof value === "string" &&
    RATING_ELIGIBILITY_STATUS_VALUES.has(/** @type {RatingEligibilityStatusValue} */ (value))
  );
}
