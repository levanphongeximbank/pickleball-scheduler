/**
 * CORE-10 — optimization run status. Unknown values fail closed.
 */

export const OPTIMIZATION_STATUS = Object.freeze({
  SUCCESS: "SUCCESS",
  INFEASIBLE: "INFEASIBLE",
  INVALID: "INVALID",
  BUDGET_EXHAUSTED: "BUDGET_EXHAUSTED",
  WATCHDOG_TIMEOUT: "WATCHDOG_TIMEOUT",
  UNSUPPORTED: "UNSUPPORTED",
  FAILED: "FAILED",
});

export const OPTIMIZATION_STATUS_VALUES = Object.freeze(
  Object.values(OPTIMIZATION_STATUS)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isOptimizationStatus(value) {
  return (
    typeof value === "string" &&
    OPTIMIZATION_STATUS_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, status: string } | { ok: false, reason: string }}
 */
export function resolveOptimizationStatus(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "STATUS_REQUIRED" };
  }
  if (!isOptimizationStatus(value)) {
    return { ok: false, reason: "STATUS_UNKNOWN" };
  }
  return { ok: true, status: /** @type {string} */ (value) };
}
