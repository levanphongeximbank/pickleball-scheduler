/**
 * Compatibility notes for PICK_VN Notification Phase 1.1
 * ======================================================
 *
 * Source of Truth (new):
 *   `src/features/notifications/` public API via `index.js`
 *   Domain modules must emit via `emitNotificationEvent` only.
 *
 * Intentionally preserved (do not delete in Phase 1.1):
 *   - `src/features/mobile/services/notificationService.js` — mobile inbox / push prefs
 *   - `src/features/mobile/services/notificationDispatchService.js` — mobile event dispatch
 *   - `src/core/platform` workflow notification dispatcher — platform workflow notify
 *   - `src/features/club/services/clubScheduleNotificationBridge.js` — club → mobile bridge
 *   - `src/features/individual-tournament/engines/playerNotificationEngine.js` — portal derived
 *   - `src/domain/bookingReminderService.js` — booking reminders
 *   - CRM messaging under `src/features/crm/`
 *   - Legacy channel job/log path:
 *       `services/notificationService.js` (sendNotification / templates)
 *       `providers/*` (Email / SMS / Zalo / Mock)
 *       `storage/notificationStorage.js`
 *
 * Deprecation direction (Phase 1.2+):
 *   - Migrate domain callers to `emitNotificationEvent`
 *   - Route mobile / club / booking / billing bridges through adapters
 *   - Keep legacy `sendNotification` as integration-admin tooling until
 *     delivery orchestration owns Email/SMS/Zalo/Push
 *
 * Security:
 *   - Do not put SMTP / SMS / Zalo / VAPID secrets in `VITE_*`
 *   - Phase 1.1 does not enable live delivery channels
 *   - Public API must not export provider or storage implementations
 */
export const NOTIFICATION_COMPATIBILITY = Object.freeze({
  phase: "1.1",
  sourceOfTruth: "src/features/notifications",
  legacyPreserved: true,
  liveDeliveryEnabled: false,
});
