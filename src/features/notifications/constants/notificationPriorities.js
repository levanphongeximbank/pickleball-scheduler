/**
 * Canonical notification priority (Phase 1.2).
 */
export const NOTIFICATION_PRIORITIES = Object.freeze({
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

export const NOTIFICATION_PRIORITY_VALUES = Object.freeze(
  Object.values(NOTIFICATION_PRIORITIES)
);

export function isValidNotificationPriority(priority) {
  return NOTIFICATION_PRIORITY_VALUES.includes(priority);
}
