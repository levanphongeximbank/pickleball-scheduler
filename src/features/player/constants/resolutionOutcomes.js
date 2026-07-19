/** Phase 1B — official player identity resolution outcomes. */

export const RESOLUTION_OUTCOME = Object.freeze({
  MAPPED: "MAPPED",
  DERIVED: "DERIVED",
  UNMAPPED: "UNMAPPED",
  INVALID: "INVALID",
  AMBIGUOUS: "AMBIGUOUS",
});

export const RESOLUTION_OUTCOMES = Object.freeze(Object.values(RESOLUTION_OUTCOME));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isResolutionOutcome(value) {
  return RESOLUTION_OUTCOMES.includes(String(value || ""));
}
