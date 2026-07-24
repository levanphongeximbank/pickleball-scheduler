/**
 * CM-04 configuration revision (optimistic concurrency).
 * Distinct from CM-01 definition revision and CM-03 version number.
 */

export const COMPETITION_CONFIGURATION_INITIAL_REVISION = 1;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCompetitionConfigurationRevision(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1;
}

/**
 * @param {number} current
 * @returns {number}
 */
export function nextCompetitionConfigurationRevision(current) {
  if (!isValidCompetitionConfigurationRevision(current)) {
    throw new TypeError(
      "nextCompetitionConfigurationRevision requires integer revision >= 1"
    );
  }
  return current + 1;
}
