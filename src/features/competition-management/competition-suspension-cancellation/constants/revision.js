/**
 * CM-07 lifecycle revision (monotonic per tenantId + competitionId).
 *
 * Distinct from CM-01 definition revision, CM-03 version number,
 * CM-04/05 revisions, and CM-06 publication revision.
 */

export const COMPETITION_LIFECYCLE_INITIAL_REVISION = 1;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCompetitionLifecycleRevision(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1;
}

/**
 * @param {number} current
 * @returns {number}
 */
export function nextCompetitionLifecycleRevision(current) {
  if (!isValidCompetitionLifecycleRevision(current)) {
    throw new TypeError(
      "nextCompetitionLifecycleRevision requires integer revision >= 1"
    );
  }
  return current + 1;
}

/**
 * Expected concurrency token before first lifecycle record.
 * Accepts explicit 0 or null (no hidden fallback).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidExpectedLifecycleRevision(value) {
  return value === null || (Number.isInteger(value) && /** @type {number} */ (value) >= 0);
}

/**
 * Normalize expected revision for comparison (null → 0).
 * @param {unknown} value
 * @returns {number|null}
 */
export function normalizeExpectedLifecycleRevision(value) {
  if (value === null) return 0;
  if (Number.isInteger(value) && /** @type {number} */ (value) >= 0) {
    return /** @type {number} */ (value);
  }
  return null;
}
