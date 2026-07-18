/**
 * Compatibility notes for PICK_VN Notification Phase 1.4
 * ======================================================
 *
 * Source of Truth:
 *   Supabase `public.notification_inbox` (+ `notification_delivery_jobs`)
 *   App access via Notification Repository (memory / local / supabase).
 *   Runtime bootstrap wires Supabase when configured; refuses silent local
 *   fallback when VITE_NOTIFICATION_REQUIRE_SUPABASE=true.
 *
 * Phase 1.4 adds:
 *   - Runtime repository + identity directory bootstrap
 *   - Header badge + Notification Center on canonical inbox
 *   - Mobile compatibility adapter (canonical preferred, legacy merged, deduped)
 *   - MATCH_SCHEDULED wired from tournament schedule publish boundary
 *
 * Still NOT live:
 *   Email / SMS / Zalo / Web Push providers
 *
 * Remaining legacy paths:
 *   - Platform runtime notificationService (local) — not used by Header after 1.4
 *   - Mobile `public.notifications` / localStorage — readable via compat adapter
 *   - Legacy sendNotification / template API (sprint10)
 *   - Player Portal derived feed, CRM campaigns
 *   - Competition Engine internals (untouched)
 */
export const NOTIFICATION_COMPATIBILITY = Object.freeze({
  phase: "1.4",
  sourceOfTruth: "supabase.notification_inbox",
  repositoryModes: Object.freeze(["memory", "local", "supabase"]),
  legacyPreserved: true,
  liveDeliveryEnabled: false,
  queueEnabled: true,
  runtimeBootstrap: true,
  headerUsesCanonicalInbox: true,
  mobileCompatAdapter: true,
  pilots: Object.freeze([
    "CLUB_SCHEDULE_UPDATED",
    "BOOKING_CREATED",
    "BOOKING_CANCELLED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_FAILED",
    "MATCH_SCHEDULED",
  ]),
  remainingLegacyPaths: Object.freeze([
    "platform.runtime.notificationService",
    "mobile.public.notifications",
    "legacy.sendNotification",
    "crm.campaigns",
    "playerPortal.derivedFeed",
  ]),
});
