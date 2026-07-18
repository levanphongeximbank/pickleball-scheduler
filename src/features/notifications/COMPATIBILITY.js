/**
 * Compatibility notes for PICK_VN Notification Phase 1.5
 * ======================================================
 *
 * Source of Truth:
 *   Supabase `public.notification_inbox` (+ `notification_delivery_jobs`)
 *   Delivery attempts: `notification_delivery_attempts`
 *   Worker: server-side `runNotificationWorkerOnce()` (sandbox / in_app only)
 *
 * Phase 1.5 adds:
 *   - Delivery job state machine + atomic claim/lease
 *   - Retry / backoff / dead-letter
 *   - Attempt audit records
 *   - Sandbox provider orchestration (no live channels)
 *   - Staging QA cleanup RPC for phase14s namespaced rows
 *
 * Still NOT live:
 *   Email / SMS / Zalo / Web Push providers
 *
 * Legacy retirement (Phase 1.5):
 *   - Club schedule pilot: already canonical-only (no dual-write)
 *   - Header / Notification Center: canonical inbox only
 *   - New domain emits: must use emitDomainNotificationEvent
 *
 * Remaining legacy paths (retained intentionally):
 *   - Platform runtime notificationService (local) — not used by Header
 *   - Mobile `public.notifications` / localStorage — readable via compat adapter
 *   - Legacy sendNotification / template API (sprint10)
 *   - CRM campaign messaging
 *   - Player Portal derived feed
 *   - Competition Engine internals (untouched)
 */

export const NOTIFICATION_COMPATIBILITY = Object.freeze({
  phase: "1.5",
  sourceOfTruth: "supabase.notification_inbox",
  repositoryModes: Object.freeze(["memory", "local", "supabase"]),
  legacyPreserved: true,
  liveDeliveryEnabled: false,
  queueEnabled: true,
  workerEnabled: true,
  workerLiveChannelsBlocked: true,
  deliveryModes: Object.freeze(["sandbox", "disabled"]),
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
  deprecatedWritePaths: Object.freeze([
    "header.localNotificationService",
    "clubSchedule.dualWriteToMobileInbox",
  ]),
  remainingLegacyPaths: Object.freeze([
    "platform.runtime.notificationService",
    "mobile.public.notifications",
    "legacy.sendNotification",
    "crm.campaigns",
    "playerPortal.derivedFeed",
  ]),
});
