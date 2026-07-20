/**
 * Core-03 Phase 1C — eligibility evaluation operation identifiers.
 */

export const ELIGIBILITY_EVALUATION_OPERATION = Object.freeze({
  EVALUATE_REGISTRATION: "EVALUATE_REGISTRATION_ELIGIBILITY",
});

/** @type {ReadonlySet<string>} */
export const ELIGIBILITY_EVALUATION_OPERATION_VALUES = new Set(
  Object.values(ELIGIBILITY_EVALUATION_OPERATION)
);

export const ELIGIBILITY_EVALUATION_SYSTEM_ACTOR = "core03-eligibility-evaluator";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEligibilityEvaluationOperation(value) {
  return typeof value === "string" && ELIGIBILITY_EVALUATION_OPERATION_VALUES.has(value);
}
