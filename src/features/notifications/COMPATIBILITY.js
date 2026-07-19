/**
 * Compatibility notes for PICK_VN Notification Phase 1.7
 * ======================================================
 *
 * Source of Truth:
 *   Supabase `public.notification_inbox` (+ `notification_delivery_jobs`)
 *   Delivery attempts: `notification_delivery_attempts`
 *   Worker runs: `notification_worker_runs`
 *   Worker: server-side `runNotificationWorkerOnce()` (sandbox / in_app only)
 *
 * Phase 1.7 finalizes Phase 1.1–1.6 foundation readiness (docs, rollback
 * consistency, regression evidence, remote sync / PR readiness). No new
 * live delivery channels.
 *
 * Phase 1.6 added:
 *   - Strict environment isolation (local|test|staging|production)
 *   - Worker scope: environment + tenant + run_namespace + job_source
 *   - Worker-run audit + heartbeat + abandoned detection
 *   - Queue health aggregates (no secrets)
 *   - Controlled cancel / dead-letter replay / stale lease recovery
 *   - QA cleanup for phase14s:|phase15:|phase16: namespaces
 *   - Structured safe worker logs
 *
 * Still NOT live:
 *   Email / SMS / Zalo / Web Push providers
 *   Production worker execution (structurally present, blocked)
 *   Production SQL apply / Production deployment (Phase 2B remediates; Phase 2C may apply)
 *
 * Phase 2B (Production Safety Remediation):
 *   - Dedicated Production SQL pack with fail-closed seeds
 *   - Dual-flag Production worker gate (still disabled by default)
 *   - Apply/verify/rollback/ops tooling (dry-run default; no live apply)
 *
 * Legacy path classification (Phase 1.7):
 *   - header.localNotificationService → deprecated-write (retired)
 *   - clubSchedule.dualWriteToMobileInbox → deprecated-write (retired for schedule pilot)
 *   - clubSchedule.canonical emit → canonicalized
 *   - Header / Notification Center → canonicalized
 *   - platform.runtime.notificationService → intentionally retained (local workflow UI)
 *   - mobile.public.notifications → compatibility-read-only (+ limited legacy writes for governance)
 *   - legacy.sendNotification (sprint10) → intentionally retained (mock marketplace API)
 *   - crm.campaigns → intentionally retained (separate campaign delivery)
 *   - playerPortal.derivedFeed → intentionally retained (derived read model)
 *   - Competition Engine → untouched (blocked pending any future boundary-only adapters)
 */

export const NOTIFICATION_COMPATIBILITY = Object.freeze({
  phase: "1.7",
  productionSafetyPhase: "2B",
  sourceOfTruth: "supabase.notification_inbox",
  repositoryModes: Object.freeze(["memory", "local", "supabase"]),
  legacyPreserved: true,
  liveDeliveryEnabled: false,
  queueEnabled: true,
  workerEnabled: true,
  workerLiveChannelsBlocked: true,
  workerOpsEnabled: true,
  environmentIsolation: true,
  productionWorkerBlocked: true,
  productionSafetyRemediated: true,
  productionSqlPackReady: true,
  foundationFinalized: true,
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
  canonicalizedPaths: Object.freeze([
    "clubSchedule.canonicalEmit",
    "header.canonicalInbox",
    "notificationCenter.canonicalInbox",
    "domain.emitDomainNotificationEvent",
  ]),
  remainingLegacyPaths: Object.freeze([
    {
      id: "platform.runtime.notificationService",
      classification: "intentionally_retained",
      note: "Local platform workflow notifications; not Header SoT",
    },
    {
      id: "mobile.public.notifications",
      classification: "compatibility_read_only",
      note: "Mobile compat adapter reads; governance may still write locally",
    },
    {
      id: "legacy.sendNotification",
      classification: "intentionally_retained",
      note: "Sprint10 mock email/template API",
    },
    {
      id: "crm.campaigns",
      classification: "intentionally_retained",
      note: "Campaign delivery is separate from inbox SoT",
    },
    {
      id: "playerPortal.derivedFeed",
      classification: "intentionally_retained",
      note: "Derived feed; not a duplicate write of canonical inbox",
    },
  ]),
  blockedPendingMigration: Object.freeze([
    "competitionEngine.internalNotifications",
  ]),
});
