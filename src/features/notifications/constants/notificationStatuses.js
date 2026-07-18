/**
 * Canonical notification record status model.
 *
 * Inbox lifecycle:
 *   CREATED → QUEUED → SENT | FAILED
 *   any unread → READ (via inbox mark-read APIs)
 *
 * Delivery jobs use CREATED | QUEUED | SENT | FAILED (no READ).
 * Phase 1.3 enqueues in_app jobs to QUEUED; live channel workers are Phase 1.4+.
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
