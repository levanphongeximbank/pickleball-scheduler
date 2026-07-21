/**
 * CORE-10 — stable failure codes. Unknown values fail closed.
 */

export const OPTIMIZATION_FAILURE_CODE = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_CONTEXT: "INVALID_CONTEXT",
  INVALID_POLICY: "INVALID_POLICY",
  INVALID_OPERATION: "INVALID_OPERATION",
  TENANT_SCOPE_MISMATCH: "TENANT_SCOPE_MISMATCH",
  COMPETITION_SCOPE_MISMATCH: "COMPETITION_SCOPE_MISMATCH",
  SNAPSHOT_FINGERPRINT_MISMATCH: "SNAPSHOT_FINGERPRINT_MISMATCH",
  INVALID_DECISION_DOMAIN: "INVALID_DECISION_DOMAIN",
  INVALID_CANDIDATE: "INVALID_CANDIDATE",
  NON_DETERMINISTIC_INPUT: "NON_DETERMINISTIC_INPUT",
  UNSUPPORTED_STRATEGY: "UNSUPPORTED_STRATEGY",
  INFEASIBLE: "INFEASIBLE",
  BUDGET_EXHAUSTED: "BUDGET_EXHAUSTED",
  WATCHDOG_TIMEOUT: "WATCHDOG_TIMEOUT",
});

export const OPTIMIZATION_FAILURE_CODE_VALUES = Object.freeze(
  Object.values(OPTIMIZATION_FAILURE_CODE)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isOptimizationFailureCode(value) {
  return (
    typeof value === "string" &&
    OPTIMIZATION_FAILURE_CODE_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, code: string } | { ok: false, reason: string }}
 */
export function resolveOptimizationFailureCode(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "FAILURE_CODE_REQUIRED" };
  }
  if (!isOptimizationFailureCode(value)) {
    return { ok: false, reason: "FAILURE_CODE_UNKNOWN" };
  }
  return { ok: true, code: /** @type {string} */ (value) };
}
