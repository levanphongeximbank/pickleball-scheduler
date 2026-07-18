/**
 * Compatibility notes for PICK_VN Notification Phase 1.2
 * ======================================================
 *
 * Source of Truth:
 *   `src/features/notifications/` via `index.js`
 *   Domain pilots must use `emitDomainNotificationEvent` (or domain pilot adapters).
 *
 * Phase 1.2 pilots wired:
 *   - Club schedule → `notifyClubMembers` → canonical inbox (no mobile dual-write)
 *   - Booking create/cancel → `bookingService` → booking pilot adapter
 *   - Payment callback → paymentsHandler → payment pilot (no forceMock email)
 *   - MATCH_SCHEDULED → competition boundary adapter only (engine untouched)
 *
 * Booking reminder vs booking event:
 *   - Event: BOOKING_CREATED / BOOKING_CANCELLED (lifecycle, this module)
 *   - Reminder: `src/domain/bookingReminderService.js` browser "sắp tới" (unchanged)
 *
 * Intentionally NOT migrated yet:
 *   - Mobile push dispatch / Web Push
 *   - Player Portal derived feed
 *   - CRM campaign messaging
 *   - Club governance mobile notifications (`notifyClubGovernanceChange`)
 *   - Legacy `sendNotification` channel jobs (admin/integration tooling)
 *   - Live Email / SMS / Zalo providers
 *
 * Deprecation:
 *   - Prefer `emitDomainNotificationEvent` over `emitNotificationEvent` for new callers
 *   - Prefer pilot adapters over direct provider calls
 *
 * Security:
 *   - No SMTP / SMS / Zalo / VAPID secrets in `VITE_*`
 *   - No live delivery channels in Phase 1.2
 *   - Public API does not export providers or inbox storage
 */
export const NOTIFICATION_COMPATIBILITY = Object.freeze({
  phase: "1.2",
  sourceOfTruth: "src/features/notifications",
  legacyPreserved: true,
  liveDeliveryEnabled: false,
  pilots: Object.freeze([
    "CLUB_SCHEDULE_UPDATED",
    "BOOKING_CREATED",
    "BOOKING_CANCELLED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_FAILED",
    "MATCH_SCHEDULED",
  ]),
});
