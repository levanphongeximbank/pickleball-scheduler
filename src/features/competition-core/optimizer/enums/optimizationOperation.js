/**
 * CORE-10 — generic operation identifiers.
 * Must remain generic; does not own another CORE's domain algorithm.
 */

export const OPTIMIZATION_OPERATION = Object.freeze({
  /** Generic assignment over declared decision variables. */
  GENERIC_ASSIGNMENT: "GENERIC_ASSIGNMENT",
  /** Generic ranking / selection among supplied candidates. */
  GENERIC_CANDIDATE_RANKING: "GENERIC_CANDIDATE_RANKING",
  /** Contract validation / replay materialization only. */
  CONTRACT_VALIDATE: "CONTRACT_VALIDATE",
});

export const OPTIMIZATION_OPERATION_VALUES = Object.freeze(
  Object.values(OPTIMIZATION_OPERATION)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isOptimizationOperation(value) {
  return (
    typeof value === "string" &&
    OPTIMIZATION_OPERATION_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, operationId: string } | { ok: false, reason: string }}
 */
export function resolveOptimizationOperation(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "OPERATION_REQUIRED" };
  }
  if (!isOptimizationOperation(value)) {
    return { ok: false, reason: "INVALID_OPERATION" };
  }
  return { ok: true, operationId: /** @type {string} */ (value) };
}
