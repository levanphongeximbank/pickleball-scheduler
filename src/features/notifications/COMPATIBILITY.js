/**
 * Compatibility notes for PICK_VN Notification Phase 1.3
 * ======================================================
 *
 * Source of Truth:
 *   Supabase `public.notification_inbox` (+ `notification_delivery_jobs`)
 *   App access via Notification Repository (memory / local / supabase).
 *   Legacy mobile `public.notifications` table remains for mobile sprint9.
 *
 * Phase 1.3 adds:
 *   - Repository: create, list, markRead, markAllRead, countUnread
 *   - Identity/Membership RecipientDirectory
 *   - Delivery queue foundation (CREATED → QUEUED → SENT|FAILED) — no live workers
 *
 * Still NOT live:
 *   Email / SMS / Zalo / Web Push providers
 *
 * Not migrated:
 *   Player Portal derived feed, CRM campaigns, Competition Engine internals,
 *   club governance mobile path, browser booking start reminders
 */
export const NOTIFICATION_COMPATIBILITY = Object.freeze({
  phase: "1.3",
  sourceOfTruth: "supabase.notification_inbox",
  repositoryModes: Object.freeze(["memory", "local", "supabase"]),
  legacyPreserved: true,
  liveDeliveryEnabled: false,
  queueEnabled: true,
  pilots: Object.freeze([
    "CLUB_SCHEDULE_UPDATED",
    "BOOKING_CREATED",
    "BOOKING_CANCELLED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_FAILED",
    "MATCH_SCHEDULED",
  ]),
});
