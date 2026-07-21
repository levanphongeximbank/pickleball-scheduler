/** Pending event dispatch status values (Phase 1F). */

export const PENDING_EVENT_STATUS = Object.freeze({
  PENDING: "PENDING",
  CLAIMED: "CLAIMED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  FAILED: "FAILED",
});

export const PENDING_EVENT_STATUS_VALUES = Object.freeze(Object.values(PENDING_EVENT_STATUS));

export const PENDING_EVENT_TERMINAL_STATUSES = Object.freeze([
  PENDING_EVENT_STATUS.ACKNOWLEDGED,
  PENDING_EVENT_STATUS.FAILED,
]);

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isPendingEventStatus(status) {
  return PENDING_EVENT_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isPendingEventTerminalStatus(status) {
  return PENDING_EVENT_TERMINAL_STATUSES.includes(String(status || ""));
}
