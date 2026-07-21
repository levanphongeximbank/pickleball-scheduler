/** Canonical CRM task priorities (Phase 1E). */

export const CRM_TASK_PRIORITY = Object.freeze({
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
});

export const CRM_TASK_PRIORITY_VALUES = Object.freeze(Object.values(CRM_TASK_PRIORITY));

/**
 * @param {string} priority
 * @returns {boolean}
 */
export function isCrmTaskPriority(priority) {
  return CRM_TASK_PRIORITY_VALUES.includes(String(priority || ""));
}
