/**
 * CM-06 publication revision (monotonic per tenant+competition+channel).
 *
 * Distinct from:
 * - CM-03 CompetitionVersion number (immutable source snapshot identity)
 * - CM-01 definition revision
 * - CM-04 configuration revision
 * - CM-05 branding revision
 */

export const COMPETITION_PUBLICATION_INITIAL_REVISION = 1;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCompetitionPublicationRevision(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1;
}

/**
 * @param {number} current
 * @returns {number}
 */
export function nextCompetitionPublicationRevision(current) {
  if (!isValidCompetitionPublicationRevision(current)) {
    throw new TypeError(
      "nextCompetitionPublicationRevision requires integer revision >= 1"
    );
  }
  return current + 1;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidExpectedCurrentPublicationRevision(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 0;
}
