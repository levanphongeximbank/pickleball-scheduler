/** @typedef {import('../types/engineRunStatus.js').EngineRunStatusValue} EngineRunStatusValue */

export const ENGINE_RUN_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

/** @type {ReadonlySet<EngineRunStatusValue>} */
export const ENGINE_RUN_STATUS_VALUES = new Set(Object.values(ENGINE_RUN_STATUS));

/**
 * @param {unknown} value
 * @returns {value is EngineRunStatusValue}
 */
export function isEngineRunStatus(value) {
  return (
    typeof value === "string" &&
    ENGINE_RUN_STATUS_VALUES.has(/** @type {EngineRunStatusValue} */ (value))
  );
}
