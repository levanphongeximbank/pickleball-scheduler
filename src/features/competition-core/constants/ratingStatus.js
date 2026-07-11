/** @typedef {import('../types/ratingStatus.js').CompetitionRatingStatusValue} CompetitionRatingStatusValue */

/**
 * Competition Core rating lifecycle (canonical target model).
 * Does NOT replace Pick_VN `rating_status` in CC-01.
 */
export const COMPETITION_RATING_STATUS = Object.freeze({
  PROVISIONAL: "provisional",
  VERIFIED: "verified",
  LOCKED: "locked",
  SUSPENDED: "suspended",
});

/** @type {ReadonlySet<CompetitionRatingStatusValue>} */
export const COMPETITION_RATING_STATUS_VALUES = new Set(Object.values(COMPETITION_RATING_STATUS));

/**
 * @param {unknown} value
 * @returns {value is CompetitionRatingStatusValue}
 */
export function isCompetitionRatingStatus(value) {
  return (
    typeof value === "string" &&
    COMPETITION_RATING_STATUS_VALUES.has(/** @type {CompetitionRatingStatusValue} */ (value))
  );
}
