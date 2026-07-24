/**
 * Stable revision baseline for CM-01 (CM-03 will extend version history).
 */

/** Initial revision assigned on create-draft. */
export const COMPETITION_DEFINITION_INITIAL_REVISION = 1;

/**
 * Deterministic next revision from a valid current revision.
 * @param {number} current
 * @returns {number}
 */
export function nextCompetitionDefinitionRevision(current) {
  return current + 1;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCompetitionDefinitionRevision(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= COMPETITION_DEFINITION_INITIAL_REVISION
  );
}
