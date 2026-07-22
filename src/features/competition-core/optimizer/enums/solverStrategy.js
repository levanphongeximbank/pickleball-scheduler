/**
 * CORE-10 — solver strategy identifiers (extension contracts only).
 * Phase 1B does not implement production solvers. Unknown fails closed.
 */

export const SOLVER_STRATEGY = Object.freeze({
  /** Placeholder for later deterministic greedy (not implemented in 1B). */
  DETERMINISTIC_GREEDY: "DETERMINISTIC_GREEDY",
  /** Placeholder for later exhaustive search (not implemented in 1B). */
  EXHAUSTIVE: "EXHAUSTIVE",
  /** Explicit no-op / contract-only strategy for validation harnesses. */
  CONTRACT_ONLY: "CONTRACT_ONLY",
});

export const SOLVER_STRATEGY_VALUES = Object.freeze(
  Object.values(SOLVER_STRATEGY)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isSolverStrategy(value) {
  return typeof value === "string" && SOLVER_STRATEGY_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, strategy: string } | { ok: false, reason: string }}
 */
export function resolveSolverStrategy(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "STRATEGY_REQUIRED" };
  }
  if (!isSolverStrategy(value)) {
    return { ok: false, reason: "UNSUPPORTED_STRATEGY" };
  }
  return { ok: true, strategy: /** @type {string} */ (value) };
}
