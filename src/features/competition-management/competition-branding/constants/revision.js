/**
 * CM-05 branding revision (optimistic concurrency).
 * Distinct from CM-01 definition revision, CM-04 configuration revision,
 * and CM-03 CompetitionVersion number.
 */

export const COMPETITION_BRANDING_INITIAL_REVISION = 1;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCompetitionBrandingRevision(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1;
}

/**
 * @param {number} current
 * @returns {number}
 */
export function nextCompetitionBrandingRevision(current) {
  if (!isValidCompetitionBrandingRevision(current)) {
    throw new TypeError(
      "nextCompetitionBrandingRevision requires integer revision >= 1"
    );
  }
  return current + 1;
}
