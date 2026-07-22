/**
 * CORE-10 Phase 1C-A — objective-evaluation failure codes.
 * Configuration / evaluation failures only — not hard-constraint infeasibility.
 */

export const OBJECTIVE_EVALUATION_FAILURE_CODE = Object.freeze({
  INVALID_OBJECTIVE_DEFINITION: "INVALID_OBJECTIVE_DEFINITION",
  INVALID_OBJECTIVE_EXECUTION_SPEC: "INVALID_OBJECTIVE_EXECUTION_SPEC",
  DUPLICATE_OBJECTIVE_REGISTRATION: "DUPLICATE_OBJECTIVE_REGISTRATION",
  UNKNOWN_OBJECTIVE: "UNKNOWN_OBJECTIVE",
  OBJECTIVE_VERSION_MISMATCH: "OBJECTIVE_VERSION_MISMATCH",
  OBJECTIVE_EVALUATOR_MISSING: "OBJECTIVE_EVALUATOR_MISSING",
  OBJECTIVE_EVALUATOR_EXCEPTION: "OBJECTIVE_EVALUATOR_EXCEPTION",
  ASYNC_OBJECTIVE_EVALUATOR_UNSUPPORTED: "ASYNC_OBJECTIVE_EVALUATOR_UNSUPPORTED",
  MISSING_OBJECTIVE_CONTEXT: "MISSING_OBJECTIVE_CONTEXT",
  NON_FINITE_OBJECTIVE_VALUE: "NON_FINITE_OBJECTIVE_VALUE",
  UNSAFE_OBJECTIVE_INTEGER: "UNSAFE_OBJECTIVE_INTEGER",
  OBJECTIVE_SCORE_OVERFLOW: "OBJECTIVE_SCORE_OVERFLOW",
  INVALID_OBJECTIVE_EVALUATOR_RESULT: "INVALID_OBJECTIVE_EVALUATOR_RESULT",
  DUPLICATE_OBJECTIVE_EXECUTION: "DUPLICATE_OBJECTIVE_EXECUTION",
  UNSUPPORTED_NORMALIZATION_POLICY: "UNSUPPORTED_NORMALIZATION_POLICY",
});

export const OBJECTIVE_EVALUATION_FAILURE_CODE_VALUES = Object.freeze(
  Object.values(OBJECTIVE_EVALUATION_FAILURE_CODE)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isObjectiveEvaluationFailureCode(value) {
  return (
    typeof value === "string" &&
    OBJECTIVE_EVALUATION_FAILURE_CODE_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, code: string } | { ok: false, reason: string }}
 */
export function resolveObjectiveEvaluationFailureCode(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "FAILURE_CODE_REQUIRED" };
  }
  if (!isObjectiveEvaluationFailureCode(value)) {
    return { ok: false, reason: "FAILURE_CODE_UNKNOWN" };
  }
  return { ok: true, code: /** @type {string} */ (value) };
}
