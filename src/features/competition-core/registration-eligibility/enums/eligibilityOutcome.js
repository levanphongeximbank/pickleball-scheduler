/**
 * Core-03 — aggregated eligibility evaluation outcomes.
 */

export const ELIGIBILITY_OUTCOME = Object.freeze({
  ELIGIBLE: "ELIGIBLE",
  INELIGIBLE: "INELIGIBLE",
  CONDITIONAL: "CONDITIONAL",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
});

/** @type {ReadonlySet<string>} */
export const ELIGIBILITY_OUTCOME_VALUES = new Set(Object.values(ELIGIBILITY_OUTCOME));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEligibilityOutcome(value) {
  return typeof value === "string" && ELIGIBILITY_OUTCOME_VALUES.has(value);
}
