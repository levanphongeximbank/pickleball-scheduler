/**
 * Canonical notification category (Phase 1.2).
 */
export const NOTIFICATION_CATEGORIES = Object.freeze({
  COMPETITION: "COMPETITION",
  CLUB: "CLUB",
  PLAYER: "PLAYER",
  VENUE: "VENUE",
  BOOKING: "BOOKING",
  PAYMENT: "PAYMENT",
  SYSTEM: "SYSTEM",
  CRM: "CRM",
  AI: "AI",
});

export const NOTIFICATION_CATEGORY_VALUES = Object.freeze(
  Object.values(NOTIFICATION_CATEGORIES)
);

export function isValidNotificationCategory(category) {
  return NOTIFICATION_CATEGORY_VALUES.includes(category);
}
