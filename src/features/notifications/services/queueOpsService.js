/**
 * Queue operations — Phase 1.6 (cancel / replay / recover / health / cleanup).
 * Server-side orchestration over repository methods.
 */

import { getNotificationRepository } from "../repositories/notificationRepository.js";
import {
  NOTIFICATION_ENVIRONMENTS,
  normalizeNotificationEnvironment,
} from "../constants/notificationEnvironments.js";

function assertNotBrowser(options = {}) {
  if (options.allowBrowser === true) return { ok: true };
  if (typeof globalThis.window !== "undefined" && !options._testBypassEnvGuard) {
    return { ok: false, error: "browser_ops_forbidden" };
  }
  return { ok: true };
}

function assertStagingOps(environment, allowProduction = false) {
  const env = normalizeNotificationEnvironment(environment);
  if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
    return { ok: false, error: "production_execution_blocked", environment: env };
  }
  return { ok: true, environment: env };
}

export async function getNotificationQueueHealth(options = {}) {
  const browser = assertNotBrowser(options);
  if (!browser.ok) return { ok: false, error: browser.error, health: null };

  const envGuard = assertStagingOps(options.environment, options.allowProduction);
  if (!envGuard.ok) return { ok: false, error: envGuard.error, health: null };

  const repository = options.repository || getNotificationRepository();
  if (typeof repository.getQueueHealth !== "function") {
    return { ok: false, error: "queue_health_not_supported", health: null };
  }
  return repository.getQueueHealth({
    environment: envGuard.environment,
    tenantId: options.tenantId || null,
    callerRole: options.callerRole || "service_role",
    now: options.now,
  });
}

export async function cancelNotificationDeliveryJob(options = {}) {
  const browser = assertNotBrowser(options);
  if (!browser.ok) return { ok: false, error: browser.error };

  const envGuard = assertStagingOps(options.environment, options.allowProduction);
  if (!envGuard.ok) return { ok: false, error: envGuard.error };

  const repository = options.repository || getNotificationRepository();
  if (typeof repository.cancelDeliveryJob !== "function") {
    return { ok: false, error: "cancel_not_supported" };
  }
  return repository.cancelDeliveryJob({
    jobId: options.jobId,
    cancelledBy: options.cancelledBy || "ops",
    reason: options.reason,
    environment: envGuard.environment,
    tenantId: options.tenantId || null,
    forceLeased: !!options.forceLeased,
    now: options.now,
    allowProduction: options.allowProduction === true,
  });
}

export async function replayNotificationDeliveryJob(options = {}) {
  const browser = assertNotBrowser(options);
  if (!browser.ok) return { ok: false, error: browser.error };

  const envGuard = assertStagingOps(options.environment, options.allowProduction);
  if (!envGuard.ok) return { ok: false, error: envGuard.error };
  if (envGuard.environment === NOTIFICATION_ENVIRONMENTS.PRODUCTION) {
    return { ok: false, error: "production_replay_blocked_phase16" };
  }

  const repository = options.repository || getNotificationRepository();
  if (typeof repository.replayDeliveryJob !== "function") {
    return { ok: false, error: "replay_not_supported" };
  }
  return repository.replayDeliveryJob({
    jobId: options.jobId,
    replayedBy: options.replayedBy || "ops",
    reason: options.reason,
    environment: envGuard.environment,
    tenantId: options.tenantId || null,
    maxReplayCount: options.maxReplayCount,
    now: options.now,
    allowProduction: false,
  });
}

export async function recoverStaleNotificationLeases(options = {}) {
  const browser = assertNotBrowser(options);
  if (!browser.ok) return { ok: false, error: browser.error, recovered: [] };

  const envGuard = assertStagingOps(options.environment, options.allowProduction);
  if (!envGuard.ok) return { ok: false, error: envGuard.error, recovered: [] };

  const repository = options.repository || getNotificationRepository();
  if (typeof repository.recoverStaleLeases !== "function") {
    return { ok: false, error: "recover_not_supported", recovered: [] };
  }
  return repository.recoverStaleLeases({
    environment: envGuard.environment,
    tenantId: options.tenantId || null,
    runNamespace: options.runNamespace || null,
    limit: options.limit,
    staleHeartbeatMs: options.staleHeartbeatMs,
    now: options.now,
    allowProduction: options.allowProduction === true,
  });
}

export async function listDeadLetterNotificationJobs(options = {}) {
  const browser = assertNotBrowser(options);
  if (!browser.ok) return { ok: false, error: browser.error, items: [] };

  const envGuard = assertStagingOps(options.environment, options.allowProduction);
  if (!envGuard.ok) return { ok: false, error: envGuard.error, items: [] };

  const repository = options.repository || getNotificationRepository();
  if (typeof repository.listDeadLetterJobs !== "function") {
    return { ok: false, error: "list_dead_letters_not_supported", items: [] };
  }
  return repository.listDeadLetterJobs({
    environment: envGuard.environment,
    tenantId: options.tenantId || null,
    limit: options.limit,
  });
}

export async function cleanupNotificationQaRunNamespace(options = {}) {
  const browser = assertNotBrowser(options);
  if (!browser.ok) return { ok: false, error: browser.error };

  const envGuard = assertStagingOps(options.environment, options.allowProduction);
  if (!envGuard.ok) return { ok: false, error: envGuard.error };

  const repository = options.repository || getNotificationRepository();
  if (typeof repository.cleanupQaRunNamespace !== "function") {
    return { ok: false, error: "qa_cleanup_run_namespace_not_supported" };
  }
  return repository.cleanupQaRunNamespace({
    environment: envGuard.environment,
    runNamespace: options.runNamespace,
    tenantId: options.tenantId || null,
    dryRun: options.dryRun !== false,
    allowProduction: false,
  });
}

export async function markAbandonedNotificationWorkerRuns(options = {}) {
  const browser = assertNotBrowser(options);
  if (!browser.ok) return { ok: false, error: browser.error, runs: [] };

  const envGuard = assertStagingOps(options.environment, options.allowProduction);
  if (!envGuard.ok) return { ok: false, error: envGuard.error, runs: [] };

  const repository = options.repository || getNotificationRepository();
  if (typeof repository.markAbandonedWorkerRuns !== "function") {
    return { ok: false, error: "mark_abandoned_not_supported", runs: [] };
  }
  return repository.markAbandonedWorkerRuns({
    environment: envGuard.environment,
    staleMs: options.staleMs,
    now: options.now,
  });
}
