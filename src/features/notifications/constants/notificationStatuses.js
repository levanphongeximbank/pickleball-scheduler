/**
 * Canonical notification record status model (Phase 1.1).
 *
 * Lifecycle (delivery-ready shape; Phase 1.1 only persists CREATED / READ):
 *   CREATED → QUEUED → SENT | FAILED
 *   any unread → READ (via inbox mark-read APIs)
 *
 * Internal note: QUEUED / SENT / FAILED are reserved for channel delivery
 * in later phases. Phase 1.1 does not enqueue or call live providers.
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
