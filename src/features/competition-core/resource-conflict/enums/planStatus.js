/**
 * CORE-14 — PlanStatus (separate from EvaluationStatus).
 */

export const PLAN_STATUS = Object.freeze({
  VALID: "VALID",
  VALID_WITH_WARNINGS: "VALID_WITH_WARNINGS",
  INVALID_HARD_CONFLICTS: "INVALID_HARD_CONFLICTS",
  NOT_EVALUATED: "NOT_EVALUATED",
});

export const PLAN_STATUS_VALUES = Object.freeze([
  PLAN_STATUS.VALID,
  PLAN_STATUS.VALID_WITH_WARNINGS,
  PLAN_STATUS.INVALID_HARD_CONFLICTS,
  PLAN_STATUS.NOT_EVALUATED,
]);

const PLAN_STATUS_SET = new Set(PLAN_STATUS_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isPlanStatus(value) {
  return typeof value === "string" && PLAN_STATUS_SET.has(value);
}
