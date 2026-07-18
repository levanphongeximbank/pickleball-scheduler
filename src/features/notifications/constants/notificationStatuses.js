/**
 * Canonical notification record status model.
 *
 * Inbox lifecycle:
 *   CREATED → QUEUED → SENT | FAILED
 *   any unread → READ (via inbox mark-read APIs)
 *
 * Delivery jobs use the Phase 1.5 state machine in deliveryJobStates.js
 * (CREATED, QUEUED, PROCESSING, SENT, RETRY_SCHEDULED, FAILED, DEAD_LETTERED, CANCELLED).
 * Live channel workers remain blocked; sandbox/in_app only.
 */
export const NOTIFICATION_STATUSES = Object.freeze({
  CREATED: "CREATED",
  QUEUED: "QUEUED",
  SENT: "SENT",
  FAILED: "FAILED",
  READ: "READ",
});

export const NOTIFICATION_STATUS_VALUES = Object.freeze(
  Object.values(NOTIFICATION_STATUSES)
);

export function isValidNotificationStatus(status) {
  return NOTIFICATION_STATUS_VALUES.includes(status);
}
