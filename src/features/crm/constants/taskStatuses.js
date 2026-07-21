/** Canonical CRM task statuses (Phase 1B). */

export const CRM_TASK_STATUS = Object.freeze({
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  CANCELLED: "cancelled",
});

export const CRM_TASK_STATUS_VALUES = Object.freeze(Object.values(CRM_TASK_STATUS));

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isCrmTaskStatus(status) {
  return CRM_TASK_STATUS_VALUES.includes(String(status || ""));
}
