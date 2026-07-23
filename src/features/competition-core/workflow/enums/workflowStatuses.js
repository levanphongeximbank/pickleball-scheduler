/**
 * CORE-19 — owner-frozen workflow statuses (Competition Workflow Engine SSOT).
 * Match statuses remain owned by CORE-15.
 * Legacy TOURNAMENT_STATUS and Team Tournament WORKFLOW_STAGE are not CORE-19 SSOT.
 */

export const WORKFLOW_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  READY: "READY",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
});

/** @type {ReadonlySet<string>} */
export const WORKFLOW_STATUS_VALUES = new Set(Object.values(WORKFLOW_STATUS));

/** Terminal statuses — normal transitions are rejected. Restart is out of Phase 1B. */
export const WORKFLOW_TERMINAL_STATUSES = Object.freeze([
  WORKFLOW_STATUS.COMPLETED,
  WORKFLOW_STATUS.FAILED,
  WORKFLOW_STATUS.CANCELLED,
]);

/** @type {ReadonlySet<string>} */
export const WORKFLOW_TERMINAL_STATUS_SET = new Set(WORKFLOW_TERMINAL_STATUSES);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isWorkflowStatus(value) {
  return typeof value === "string" && WORKFLOW_STATUS_VALUES.has(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTerminalWorkflowStatus(value) {
  return typeof value === "string" && WORKFLOW_TERMINAL_STATUS_SET.has(value);
}
