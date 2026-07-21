/**
 * Canonical CRM task statuses (Phase 1B + Phase 1E).
 *
 * Phase 1E canonical terminal success status is COMPLETED.
 * DONE remains as a Phase 1B alias constant pointing at the same value.
 */

export const CRM_TASK_STATUS = Object.freeze({
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  /** @deprecated Phase 1B name — identical to COMPLETED */
  DONE: "completed",
});

export const CRM_TASK_STATUS_VALUES = Object.freeze([
  CRM_TASK_STATUS.OPEN,
  CRM_TASK_STATUS.IN_PROGRESS,
  CRM_TASK_STATUS.COMPLETED,
  CRM_TASK_STATUS.CANCELLED,
]);

export const CRM_TASK_TERMINAL_STATUSES = Object.freeze([
  CRM_TASK_STATUS.COMPLETED,
  CRM_TASK_STATUS.CANCELLED,
]);

/** Allowed status transitions (Phase 1E). No reopen from terminal. */
export const CRM_TASK_ALLOWED_TRANSITIONS = Object.freeze({
  [CRM_TASK_STATUS.OPEN]: Object.freeze([
    CRM_TASK_STATUS.IN_PROGRESS,
    CRM_TASK_STATUS.COMPLETED,
    CRM_TASK_STATUS.CANCELLED,
  ]),
  [CRM_TASK_STATUS.IN_PROGRESS]: Object.freeze([
    CRM_TASK_STATUS.COMPLETED,
    CRM_TASK_STATUS.CANCELLED,
  ]),
  [CRM_TASK_STATUS.COMPLETED]: Object.freeze([]),
  [CRM_TASK_STATUS.CANCELLED]: Object.freeze([]),
});

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isCrmTaskStatus(status) {
  return CRM_TASK_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isCrmTaskTerminalStatus(status) {
  return CRM_TASK_TERMINAL_STATUSES.includes(String(status || ""));
}

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
export function isAllowedCrmTaskTransition(fromStatus, toStatus) {
  const allowed = CRM_TASK_ALLOWED_TRANSITIONS[String(fromStatus || "")];
  if (!allowed) return false;
  return allowed.includes(String(toStatus || ""));
}
