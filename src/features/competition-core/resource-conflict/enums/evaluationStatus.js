/**
 * CORE-14 — EvaluationStatus (separate from PlanStatus).
 */

export const EVALUATION_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  REJECTED_INVALID_INPUT: "REJECTED_INVALID_INPUT",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
  UNSUPPORTED: "UNSUPPORTED",
});

export const EVALUATION_STATUS_VALUES = Object.freeze([
  EVALUATION_STATUS.COMPLETED,
  EVALUATION_STATUS.REJECTED_INVALID_INPUT,
  EVALUATION_STATUS.DATA_UNAVAILABLE,
  EVALUATION_STATUS.UNSUPPORTED,
]);

const EVALUATION_STATUS_SET = new Set(EVALUATION_STATUS_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isEvaluationStatus(value) {
  return typeof value === "string" && EVALUATION_STATUS_SET.has(value);
}
