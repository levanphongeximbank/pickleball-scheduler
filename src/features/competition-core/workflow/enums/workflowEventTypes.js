/**
 * CORE-19 — workflow domain event types.
 * Restart/resume execution contracts belong to a later CORE-19 capability;
 * types are reserved for stable vocabulary.
 */

/**
 * Workflow domain event vocabulary (identity-complete for future CORE-20).
 * No persistence here. Restart/resume are workflow-level only (not CORE-15/23).
 */
export const WORKFLOW_EVENT_TYPE = Object.freeze({
  TRANSITION_REQUESTED: "TRANSITION_REQUESTED",
  TRANSITION_AUTHORIZED: "TRANSITION_AUTHORIZED",
  TRANSITION_DENIED: "TRANSITION_DENIED",
  TRANSITION_STARTED: "TRANSITION_STARTED",
  TRANSITION_COMPLETED: "TRANSITION_COMPLETED",
  TRANSITION_FAILED: "TRANSITION_FAILED",
  WORKFLOW_PAUSED: "WORKFLOW_PAUSED",
  WORKFLOW_RESUMED: "WORKFLOW_RESUMED",
  WORKFLOW_RESTARTED: "WORKFLOW_RESTARTED",
  WORKFLOW_COMPLETED: "WORKFLOW_COMPLETED",
  WORKFLOW_FAILED: "WORKFLOW_FAILED",
});

/** @type {ReadonlySet<string>} */
export const WORKFLOW_EVENT_TYPE_VALUES = new Set(
  Object.values(WORKFLOW_EVENT_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isWorkflowEventType(value) {
  return typeof value === "string" && WORKFLOW_EVENT_TYPE_VALUES.has(value);
}
