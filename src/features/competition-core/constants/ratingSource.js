/** @typedef {import('../types/ratingSource.js').RatingSourceValue} RatingSourceValue */

export const RATING_SOURCE = Object.freeze({
  QUESTIONNAIRE: "questionnaire",
  MANUAL: "manual",
  TOURNAMENT: "tournament",
  MONTHLY_REVIEW: "monthly_review",
  MIGRATION: "migration",
  CLUB: "club",
  SYSTEM: "system",
});

/** @type {ReadonlySet<RatingSourceValue>} */
export const RATING_SOURCE_VALUES = new Set(Object.values(RATING_SOURCE));

/**
 * @param {unknown} value
 * @returns {value is RatingSourceValue}
 */
export function isRatingSource(value) {
  return typeof value === "string" && RATING_SOURCE_VALUES.has(/** @type {RatingSourceValue} */ (value));
}
