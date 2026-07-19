import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import {
  DELIVERY_JOB_STATES,
  assertDeliveryJobTransition,
  isTerminalDeliveryJobState,
} from "../constants/deliveryJobStates.js";
import { mapPriorityToQueueRank } from "../utils/deliveryIdempotency.js";
import {
  NOTIFICATION_ENVIRONMENTS,
  normalizeNotificationEnvironment,
  isAllowedQaNamespacePrefix,
} from "../constants/notificationEnvironments.js";
import {
  WORKER_RUN_STATUSES,
  isActiveWorkerRunStatus,
  resolveWorkerRunTerminalStatus,
} from "../constants/workerRunStatuses.js";
import { redactSecrets } from "../utils/safeWorkerLog.js";

function matchesUser(record, userId) {
  if (!userId) return true;
  const uid = String(userId);
  if (record.recipientUserId) {
    return String(record.recipientUserId) === uid;
  }
  const hints = record.recipientHints || {};
  const userIds = Array.isArray(hints.userIds) ? hints.userIds : [];
  return userIds.length === 0 || userIds.includes(uid);
}

function nowIso(now) {
  if (!now) return new Date().toISOString();
  if (typeof now === "function") {
    const v = now();
    return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
  }
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function toMs(value) {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * In-memory notification repository (tests / default offline).
 * Phase 1.5: claim/lease, attempts, state transitions.
 * Phase 1.6: environment isolation, worker-run audit, cancel/replay/recovery.
 */
export function createMemoryNotificationRepository(seed = []) {
  let records = Array.isArray(seed) ? [...seed] : [];
  let jobs = [];
  let attempts = [];
  let workerRuns = [];
  const DEFAULT_MAX_REPLAY = 3;
  const DEFAULT_HEARTBEAT_STALE_MS = 120_000;

  function findJobIndex(jobId) {
    return jobs.findIndex((j) => j.id === jobId);
  }

  function findRunIndex(runId) {
    return workerRuns.findIndex((r) => r.runId === runId);
  }

  return {
    mode: "memory",

    async create(record) {
      const existing = records.find(
        (r) =>
          r.tenantId === record.tenantId &&
          r.idempotencyKey === record.idempotencyKey
      );
      if (existing) {
        return { ok: true, duplicate: true, notification: existing };
      }
      records.unshift(record);
      return { ok: true, duplicate: false, notification: record };
    },

    async list({ tenantId, userId = null, status = null, limit = 100 } = {}) {
      if (!tenantId) {
        return { ok: false, error: "tenantId is required.", items: [] };
      }
      let items = records.filter((r) => r.tenantId === tenantId);
      if (userId) items = items.filter((r) => matchesUser(r, userId));
      if (status) items = items.filter((r) => r.status === status);
      return { ok: true, items: items.slice(0, Math.max(0, Number(limit) || 100)) };
    },

    async getInboxById({ notificationId, tenantId } = {}) {
      const notification =
        records.find((r) => {
          const id = r.notificationId || r.id;
          if (id !== notificationId) return false;
          if (tenantId && r.tenantId !== tenantId) return false;
          return true;
        }) || null;
      return { ok: true, notification };
    },

    async markRead({ tenantId, notificationId, userId = null } = {}) {
      if (!tenantId || !notificationId) {
        return { ok: false, error: "tenantId and notificationId are required." };
      }
      const idx = records.findIndex((r) => {
        const id = r.notificationId || r.id;
        return id === notificationId && r.tenantId === tenantId;
      });
      if (idx < 0) return { ok: false, error: "Notification not found." };
      const current = records[idx];
      if (userId && !matchesUser(current, userId)) {
        return { ok: false, error: "Notification not found for user." };
      }
      if (current.status === NOTIFICATION_STATUSES.READ) {
        return { ok: true, notification: current, alreadyRead: true };
      }
      const now = new Date().toISOString();
      const updated = {
        ...current,
        status: NOTIFICATION_STATUSES.READ,
        readAt: now,
        updatedAt: now,
      };
      records[idx] = updated;
      return { ok: true, notification: updated, alreadyRead: false };
    },

    async markAllRead({ tenantId, userId = null } = {}) {
      if (!tenantId) {
        return { ok: false, error: "tenantId is required.", updatedCount: 0 };
      }
      const now = new Date().toISOString();
      let updatedCount = 0;
      records = records.map((r) => {
        if (r.tenantId !== tenantId) return r;
        if (r.status === NOTIFICATION_STATUSES.READ) return r;
        if (userId && !matchesUser(r, userId)) return r;
        updatedCount += 1;
        return {
          ...r,
          status: NOTIFICATION_STATUSES.READ,
          readAt: now,
          updatedAt: now,
        };
      });
      return { ok: true, updatedCount };
    },

    async countUnread({ tenantId, userId = null } = {}) {
      if (!tenantId) {
        return { ok: false, error: "tenantId is required.", count: 0 };
      }
      const count = records.filter((r) => {
        if (r.tenantId !== tenantId) return false;
        if (r.status === NOTIFICATION_STATUSES.READ) return false;
        if (userId && !matchesUser(r, userId)) return false;
        return true;
      }).length;
      return { ok: true, count };
    },

    async findByIdempotencyKey({ tenantId, idempotencyKey } = {}) {
      if (!tenantId || !idempotencyKey) return { ok: true, notification: null };
      const notification =
        records.find(
          (r) => r.tenantId === tenantId && r.idempotencyKey === idempotencyKey
        ) || null;
      return { ok: true, notification };
    },

    async enqueueDeliveryJob({
      notificationId,
      tenantId,
      channel = "in_app",
      priority = null,
      maxAttempts = 5,
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace = null,
      jobSource = null,
    } = {}) {
      const existing = jobs.find(
        (j) =>
          j.notificationId === notificationId &&
          j.channel === channel &&
          !isTerminalDeliveryJobState(j.status) &&
          j.status !== DELIVERY_JOB_STATES.FAILED
      );
      if (existing) {
        return { ok: true, duplicate: true, job: existing };
      }
      const now = new Date().toISOString();
      const inbox = records.find(
        (r) => (r.notificationId || r.id) === notificationId
      );
      const queuePriority =
        priority != null
          ? Number(priority)
          : mapPriorityToQueueRank(inbox?.priority);
      const env = normalizeNotificationEnvironment(environment);
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION) {
        return { ok: false, error: "production_enqueue_blocked_phase16" };
      }

      const job = {
        id: `ndel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        notificationId,
        tenantId,
        channel,
        status: DELIVERY_JOB_STATES.QUEUED,
        attempts: 0,
        maxAttempts: Number(maxAttempts) || 5,
        lastError: null,
        providerMessageId: null,
        scheduledAt: now,
        nextAttemptAt: now,
        priority: queuePriority,
        workerId: null,
        claimedAt: null,
        leaseExpiresAt: null,
        claimToken: null,
        deliveryMode: null,
        deliveryIdempotencyKey: null,
        processedAt: null,
        environment: env,
        runNamespace: runNamespace || null,
        jobSource: jobSource || null,
        cancelRequested: false,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        replayedFromJobId: null,
        replayRequestedBy: null,
        replayReason: null,
        replayGeneration: 0,
        recoveryCount: 0,
        createdAt: now,
        updatedAt: now,
        recipientUserId: inbox?.recipientUserId || null,
      };
      jobs.unshift(job);

      const idx = records.findIndex(
        (r) => (r.notificationId || r.id) === notificationId
      );
      if (idx >= 0 && records[idx].status === NOTIFICATION_STATUSES.CREATED) {
        records[idx] = {
          ...records[idx],
          status: NOTIFICATION_STATUSES.QUEUED,
          updatedAt: now,
        };
      }

      return { ok: true, duplicate: false, job };
    },

    async listDeliveryJobs({ tenantId, status = null, limit = 100 } = {}) {
      let items = tenantId ? jobs.filter((j) => j.tenantId === tenantId) : [...jobs];
      if (status) items = items.filter((j) => j.status === status);
      return { ok: true, items: items.slice(0, Math.max(0, Number(limit) || 100)) };
    },

    /**
     * Atomic claim with lease. Two workers cannot claim the same job.
     * Expired leases may be reclaimed; unexpired leases cannot be stolen.
     */
    async claimDeliveryJobs({
      workerId,
      batchSize = 10,
      leaseSeconds = 60,
      tenantId = null,
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace = null,
      jobSource = null,
      now = null,
      allowProduction = false,
    } = {}) {
      if (!workerId) {
        return { ok: false, error: "worker_id_required", jobs: [] };
      }
      const env = normalizeNotificationEnvironment(environment);
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
        return { ok: false, error: "production_execution_blocked", jobs: [] };
      }
      // Phase 2B: Production claim fails closed without tenant + namespace
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION) {
        if (!tenantId || !String(tenantId).trim()) {
          return { ok: false, error: "tenant_scope_required", jobs: [] };
        }
        if (!runNamespace || !String(runNamespace).trim()) {
          return { ok: false, error: "namespace_scope_required", jobs: [] };
        }
      }
      const ts = nowIso(now);
      const tsMs = toMs(ts);
      const leaseMs = Math.max(5, Number(leaseSeconds) || 60) * 1000;
      const limit = Math.min(50, Math.max(1, Number(batchSize) || 10));
      const ns = runNamespace ? String(runNamespace).trim() : null;
      const source = jobSource ? String(jobSource).trim() : null;

      const eligible = jobs
        .filter((j) => {
          const jobEnv = normalizeNotificationEnvironment(
            j.environment || NOTIFICATION_ENVIRONMENTS.STAGING
          );
          if (jobEnv !== env) return false;
          if (tenantId && j.tenantId !== tenantId) return false;
          if (ns && j.runNamespace !== ns) return false;
          if (source && j.jobSource !== source) return false;
          if (j.cancelRequested) return false;
          if (
            j.status === DELIVERY_JOB_STATES.QUEUED ||
            j.status === DELIVERY_JOB_STATES.RETRY_SCHEDULED
          ) {
            return toMs(j.nextAttemptAt || j.scheduledAt) <= tsMs;
          }
          if (j.status === DELIVERY_JOB_STATES.PROCESSING) {
            return j.leaseExpiresAt && toMs(j.leaseExpiresAt) < tsMs;
          }
          return false;
        })
        .sort((a, b) => {
          const p = (a.priority ?? 100) - (b.priority ?? 100);
          if (p !== 0) return p;
          const n = toMs(a.nextAttemptAt || a.scheduledAt) - toMs(b.nextAttemptAt || b.scheduledAt);
          if (n !== 0) return n;
          return toMs(a.createdAt) - toMs(b.createdAt);
        });

      const claimed = [];
      for (const job of eligible) {
        if (claimed.length >= limit) break;
        const idx = findJobIndex(job.id);
        if (idx < 0) continue;
        const current = jobs[idx];
        if (current.status === DELIVERY_JOB_STATES.PROCESSING) {
          if (current.leaseExpiresAt && toMs(current.leaseExpiresAt) >= tsMs) {
            continue;
          }
        } else if (
          current.status !== DELIVERY_JOB_STATES.QUEUED &&
          current.status !== DELIVERY_JOB_STATES.RETRY_SCHEDULED
        ) {
          continue;
        } else if (toMs(current.nextAttemptAt || current.scheduledAt) > tsMs) {
          continue;
        }

        if (current.status !== DELIVERY_JOB_STATES.PROCESSING) {
          const transition = assertDeliveryJobTransition(
            current.status,
            DELIVERY_JOB_STATES.PROCESSING
          );
          if (!transition.ok) continue;
        }

        const claimToken = `claim_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        const updated = {
          ...current,
          status: DELIVERY_JOB_STATES.PROCESSING,
          environment: env,
          workerId,
          claimedAt: ts,
          leaseExpiresAt: new Date(tsMs + leaseMs).toISOString(),
          claimToken,
          updatedAt: ts,
        };
        jobs[idx] = updated;
        claimed.push(updated);
      }

      return { ok: true, jobs: claimed };
    },

    async createDeliveryAttempt(attempt) {
      const row = {
        ...attempt,
        attemptId: attempt.attemptId || `att_${attempt.jobId}_${attempt.attemptNumber}`,
      };
      attempts.push(row);
      return { ok: true, attempt: row };
    },

    async completeDeliveryAttempt(attempt) {
      const idx = attempts.findIndex(
        (a) =>
          a.attemptId === attempt.attemptId ||
          (a.jobId === attempt.jobId && a.attemptNumber === attempt.attemptNumber)
      );
      if (idx >= 0) {
        attempts[idx] = { ...attempts[idx], ...attempt };
        return { ok: true, attempt: attempts[idx] };
      }
      attempts.push(attempt);
      return { ok: true, attempt };
    },

    async listDeliveryAttempts({ jobId } = {}) {
      const items = jobId
        ? attempts.filter((a) => a.jobId === jobId)
        : [...attempts];
      return { ok: true, items };
    },

    async completeDeliveryJob({
      jobId,
      claimToken = null,
      workerId = null,
      status,
      providerMessageId = null,
      lastError = null,
      nextAttemptAt = null,
      deliveryMode = null,
      deliveryIdempotencyKey = null,
      attemptNumber = null,
      explicitRetry = false,
    } = {}) {
      const idx = findJobIndex(jobId);
      if (idx < 0) return { ok: false, error: "Delivery job not found." };
      const current = jobs[idx];

      if (
        claimToken &&
        current.claimToken &&
        String(current.claimToken) !== String(claimToken)
      ) {
        return { ok: false, error: "claim_token_mismatch" };
      }
      if (
        workerId &&
        current.workerId &&
        String(current.workerId) !== String(workerId)
      ) {
        return { ok: false, error: "worker_id_mismatch" };
      }

      const transition = assertDeliveryJobTransition(current.status, status, {
        explicitRetry,
      });
      if (!transition.ok) {
        return { ok: false, error: transition.error, code: transition.code };
      }

      const now = new Date().toISOString();
      const updated = {
        ...current,
        status,
        lastError: lastError ?? current.lastError,
        providerMessageId:
          providerMessageId !== null ? providerMessageId : current.providerMessageId,
        attempts:
          attemptNumber != null
            ? Number(attemptNumber)
            : (current.attempts || 0) + 1,
        nextAttemptAt:
          status === DELIVERY_JOB_STATES.RETRY_SCHEDULED
            ? nextAttemptAt || current.nextAttemptAt
            : status === DELIVERY_JOB_STATES.QUEUED
              ? nextAttemptAt || current.nextAttemptAt
              : current.nextAttemptAt,
        deliveryMode: deliveryMode || current.deliveryMode,
        deliveryIdempotencyKey:
          deliveryIdempotencyKey || current.deliveryIdempotencyKey,
        processedAt: isTerminalDeliveryJobState(status) ? now : current.processedAt,
        workerId: isTerminalDeliveryJobState(status) ||
          status === DELIVERY_JOB_STATES.RETRY_SCHEDULED ||
          status === DELIVERY_JOB_STATES.FAILED
            ? null
            : current.workerId,
        claimedAt:
          status === DELIVERY_JOB_STATES.PROCESSING ? current.claimedAt : null,
        leaseExpiresAt:
          status === DELIVERY_JOB_STATES.PROCESSING ? current.leaseExpiresAt : null,
        claimToken:
          status === DELIVERY_JOB_STATES.PROCESSING ? current.claimToken : null,
        updatedAt: now,
      };
      jobs[idx] = updated;

      if (
        (status === DELIVERY_JOB_STATES.SENT || status === DELIVERY_JOB_STATES.FAILED) &&
        current.channel === "in_app"
      ) {
        const nIdx = records.findIndex(
          (r) => (r.notificationId || r.id) === updated.notificationId
        );
        if (nIdx >= 0 && records[nIdx].status !== NOTIFICATION_STATUSES.READ) {
          if (status === DELIVERY_JOB_STATES.SENT) {
            records[nIdx] = {
              ...records[nIdx],
              status: NOTIFICATION_STATUSES.SENT,
              updatedAt: now,
            };
          } else if (status === DELIVERY_JOB_STATES.FAILED) {
            records[nIdx] = {
              ...records[nIdx],
              status: NOTIFICATION_STATUSES.FAILED,
              updatedAt: now,
            };
          }
        }
      }

      return { ok: true, job: updated };
    },

    async markInboxDelivered({ notificationId, tenantId } = {}) {
      const idx = records.findIndex((r) => {
        const id = r.notificationId || r.id;
        if (id !== notificationId) return false;
        if (tenantId && r.tenantId !== tenantId) return false;
        return true;
      });
      if (idx < 0) return { ok: false, error: "Notification not found." };
      const current = records[idx];
      if (current.status === NOTIFICATION_STATUSES.READ) {
        return { ok: true, notification: current, unchanged: true };
      }
      if (current.status === NOTIFICATION_STATUSES.SENT) {
        return { ok: true, notification: current, duplicate: true };
      }
      const now = new Date().toISOString();
      const updated = {
        ...current,
        status: NOTIFICATION_STATUSES.SENT,
        updatedAt: now,
      };
      records[idx] = updated;
      return { ok: true, notification: updated };
    },

    async updateInboxStatus({ notificationId, tenantId, status } = {}) {
      return this.markInboxDelivered({ notificationId, tenantId }).then((res) => {
        if (!res.ok || status === NOTIFICATION_STATUSES.SENT) return res;
        const idx = records.findIndex(
          (r) => (r.notificationId || r.id) === notificationId
        );
        if (idx < 0) return { ok: false, error: "Notification not found." };
        if (records[idx].status === NOTIFICATION_STATUSES.READ) {
          return { ok: true, notification: records[idx], unchanged: true };
        }
        const now = new Date().toISOString();
        records[idx] = { ...records[idx], status, updatedAt: now };
        return { ok: true, notification: records[idx] };
      });
    },

    /**
     * Legacy helper — rejects worker-only terminal states from "browser" callers.
     * Auto-transitions QUEUED/RETRY_SCHEDULED → PROCESSING → target for worker callers.
     */
    async markDeliveryJobStatus({
      jobId,
      status,
      lastError = null,
      providerMessageId = null,
      caller = "worker",
      explicitRetry = false,
    } = {}) {
      if (
        caller === "browser" &&
        [
          DELIVERY_JOB_STATES.PROCESSING,
          DELIVERY_JOB_STATES.SENT,
          DELIVERY_JOB_STATES.FAILED,
          DELIVERY_JOB_STATES.DEAD_LETTERED,
        ].includes(status)
      ) {
        return { ok: false, error: "browser_cannot_set_worker_states", code: "forbidden" };
      }

      const idx = findJobIndex(jobId);
      if (idx < 0) return { ok: false, error: "Delivery job not found." };
      let current = jobs[idx];

      if (
        caller !== "browser" &&
        (current.status === DELIVERY_JOB_STATES.QUEUED ||
          current.status === DELIVERY_JOB_STATES.RETRY_SCHEDULED) &&
        status !== DELIVERY_JOB_STATES.PROCESSING &&
        status !== DELIVERY_JOB_STATES.CANCELLED
      ) {
        const now = new Date().toISOString();
        current = {
          ...current,
          status: DELIVERY_JOB_STATES.PROCESSING,
          workerId: current.workerId || "legacy_mark",
          claimedAt: now,
          leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          claimToken: current.claimToken || `legacy_${jobId}`,
          updatedAt: now,
        };
        jobs[idx] = current;
      }

      return this.completeDeliveryJob({
        jobId,
        claimToken: current.claimToken,
        workerId: current.workerId,
        status,
        lastError,
        providerMessageId,
        explicitRetry,
        attemptNumber: (current.attempts || 0) + 1,
      });
    },

    /**
     * QA cleanup — only deletes namespaced tracked inbox rows (+ cascaded jobs).
     */
    async cleanupNamespacedQaRows({
      tenantId,
      recipientUserId,
      namespacePrefix,
      ids = [],
      allowProduction = false,
      environment = "staging",
    } = {}) {
      if (environment === "production" && !allowProduction) {
        return { ok: false, error: "qa_cleanup_disabled_in_production", deleted: 0 };
      }
      if (!tenantId || !recipientUserId || !namespacePrefix) {
        return { ok: false, error: "missing_scope", deleted: 0 };
      }
      if (!isAllowedQaNamespacePrefix(namespacePrefix)) {
        return { ok: false, error: "invalid_namespace", deleted: 0 };
      }
      const idSet = new Set((ids || []).map(String));
      if (idSet.size === 0) {
        return { ok: true, deleted: 0, reason: "nothing_tracked" };
      }

      const before = records.length;
      const removedIds = new Set();
      records = records.filter((r) => {
        const id = String(r.notificationId || r.id);
        const match =
          r.tenantId === tenantId &&
          String(r.recipientUserId) === String(recipientUserId) &&
          idSet.has(id) &&
          String(r.idempotencyKey || "").startsWith(namespacePrefix);
        if (match) {
          removedIds.add(id);
          return false;
        }
        return true;
      });
      jobs = jobs.filter((j) => !removedIds.has(String(j.notificationId)));
      return { ok: true, deleted: before - records.length, ids: [...removedIds] };
    },

    async startWorkerRun({
      runId,
      workerId,
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace = null,
      tenantId = null,
      jobSource = null,
      batchSize = null,
      now = null,
      allowProduction = false,
    } = {}) {
      const env = normalizeNotificationEnvironment(environment);
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
        return { ok: false, error: "production_execution_blocked" };
      }
      if (!runId || !workerId) {
        return { ok: false, error: "run_id_and_worker_id_required" };
      }
      const ts = nowIso(now);
      const existingIdx = findRunIndex(runId);
      if (existingIdx >= 0) {
        workerRuns[existingIdx] = {
          ...workerRuns[existingIdx],
          status: WORKER_RUN_STATUSES.RUNNING,
          heartbeatAt: ts,
          updatedAt: ts,
        };
        return { ok: true, run: workerRuns[existingIdx] };
      }
      const run = {
        id: `wrun_${runId}`,
        runId,
        workerId,
        environment: env,
        runNamespace: runNamespace || null,
        tenantId: tenantId || null,
        jobSource: jobSource || null,
        status: WORKER_RUN_STATUSES.STARTED,
        startedAt: ts,
        completedAt: null,
        heartbeatAt: ts,
        claimedCount: 0,
        sentCount: 0,
        retryScheduledCount: 0,
        failedCount: 0,
        deadLetteredCount: 0,
        cancelledCount: 0,
        skippedCount: 0,
        sanitizedErrorCount: 0,
        durationMs: null,
        batchSize: batchSize == null ? null : Number(batchSize),
        createdAt: ts,
        updatedAt: ts,
      };
      workerRuns.push(run);
      return { ok: true, run };
    },

    async heartbeatWorkerRun({ runId, now = null } = {}) {
      const idx = findRunIndex(runId);
      if (idx < 0) return { ok: false, error: "worker_run_not_found" };
      const ts = nowIso(now);
      const current = workerRuns[idx];
      workerRuns[idx] = {
        ...current,
        heartbeatAt: ts,
        status: isActiveWorkerRunStatus(current.status)
          ? WORKER_RUN_STATUSES.RUNNING
          : current.status,
        updatedAt: ts,
      };
      return { ok: true, run: workerRuns[idx] };
    },

    async completeWorkerRun({
      runId,
      status = null,
      summary = {},
      now = null,
    } = {}) {
      const idx = findRunIndex(runId);
      if (idx < 0) return { ok: false, error: "worker_run_not_found" };
      const ts = nowIso(now);
      const current = workerRuns[idx];
      const terminal =
        status ||
        resolveWorkerRunTerminalStatus({
          errorCount: summary.sanitizedErrorCount || summary.errors?.length || 0,
          claimed: summary.claimed || 0,
          ok: true,
        });
      const durationMs =
        summary.durationMs != null
          ? Number(summary.durationMs)
          : Math.max(0, toMs(ts) - toMs(current.startedAt));
      workerRuns[idx] = {
        ...current,
        status: terminal,
        completedAt: ts,
        heartbeatAt: ts,
        claimedCount: summary.claimed ?? current.claimedCount,
        sentCount: summary.sent ?? current.sentCount,
        retryScheduledCount: summary.retryScheduled ?? current.retryScheduledCount,
        failedCount: summary.failed ?? current.failedCount,
        deadLetteredCount: summary.deadLettered ?? current.deadLetteredCount,
        cancelledCount: summary.cancelled ?? current.cancelledCount,
        skippedCount: summary.skipped ?? current.skippedCount,
        sanitizedErrorCount:
          summary.sanitizedErrorCount ??
          summary.errors?.length ??
          current.sanitizedErrorCount,
        durationMs,
        updatedAt: ts,
      };
      return { ok: true, run: workerRuns[idx] };
    },

    async markAbandonedWorkerRuns({
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      staleMs = DEFAULT_HEARTBEAT_STALE_MS,
      now = null,
    } = {}) {
      const env = normalizeNotificationEnvironment(environment);
      const ts = nowIso(now);
      const tsMs = toMs(ts);
      const abandoned = [];
      workerRuns = workerRuns.map((r) => {
        if (r.environment !== env) return r;
        if (!isActiveWorkerRunStatus(r.status)) return r;
        if (toMs(r.heartbeatAt) >= tsMs - Number(staleMs)) return r;
        const next = {
          ...r,
          status: WORKER_RUN_STATUSES.ABANDONED,
          completedAt: r.completedAt || ts,
          updatedAt: ts,
        };
        abandoned.push(next);
        return next;
      });
      return { ok: true, runs: abandoned };
    },

    async getQueueHealth({
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId = null,
      callerRole = "service_role",
      now = null,
    } = {}) {
      const role = String(callerRole || "").toLowerCase();
      const isAdmin =
        role === "service_role" ||
        ["platform_admin", "super_admin", "admin", "system_admin"].includes(role);
      const isTenantOwner = ["venue_owner", "tenant_owner", "court_owner"].includes(role);
      if (!isAdmin && !isTenantOwner) {
        return { ok: false, error: "queue_health_forbidden", health: null };
      }
      const env = normalizeNotificationEnvironment(environment);
      // Phase 2B: Production queue health fails closed without tenant (no cross-tenant leak)
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION && (!tenantId || !String(tenantId).trim())) {
        return { ok: false, error: "tenant_scope_required", health: null };
      }
      const tsMs = toMs(nowIso(now));
      const scoped = jobs.filter((j) => {
        if (normalizeNotificationEnvironment(j.environment || env) !== env) return false;
        if (tenantId && j.tenantId !== tenantId) return false;
        return true;
      });
      const byChannel = {};
      const byPriority = {};
      for (const j of scoped) {
        if (
          [
            DELIVERY_JOB_STATES.QUEUED,
            DELIVERY_JOB_STATES.PROCESSING,
            DELIVERY_JOB_STATES.RETRY_SCHEDULED,
            DELIVERY_JOB_STATES.FAILED,
            DELIVERY_JOB_STATES.DEAD_LETTERED,
          ].includes(j.status)
        ) {
          byChannel[j.channel] = (byChannel[j.channel] || 0) + 1;
          const p = String(j.priority ?? 100);
          byPriority[p] = (byPriority[p] || 0) + 1;
        }
      }
      const queued = scoped.filter((j) => j.status === DELIVERY_JOB_STATES.QUEUED);
      const retry = scoped.filter((j) => j.status === DELIVERY_JOB_STATES.RETRY_SCHEDULED);
      const oldestQueuedAgeSeconds = queued.length
        ? Math.max(
            0,
            Math.floor((tsMs - Math.min(...queued.map((j) => toMs(j.createdAt)))) / 1000)
          )
        : 0;
      const oldestRetryAgeSeconds = retry.length
        ? Math.max(
            0,
            Math.floor(
              (tsMs - Math.min(...retry.map((j) => toMs(j.nextAttemptAt || j.createdAt)))) /
                1000
            )
          )
        : 0;
      const health = {
        environment: env,
        tenantId: tenantId || null,
        queued: queued.length,
        processing: scoped.filter((j) => j.status === DELIVERY_JOB_STATES.PROCESSING).length,
        retryScheduled: retry.length,
        failed: scoped.filter((j) => j.status === DELIVERY_JOB_STATES.FAILED).length,
        deadLettered: scoped.filter((j) => j.status === DELIVERY_JOB_STATES.DEAD_LETTERED)
          .length,
        cancelled: scoped.filter((j) => j.status === DELIVERY_JOB_STATES.CANCELLED).length,
        sent: scoped.filter((j) => j.status === DELIVERY_JOB_STATES.SENT).length,
        oldestQueuedAgeSeconds,
        oldestRetryAgeSeconds,
        expiredLeases: scoped.filter(
          (j) =>
            j.status === DELIVERY_JOB_STATES.PROCESSING &&
            j.leaseExpiresAt &&
            toMs(j.leaseExpiresAt) < tsMs
        ).length,
        byChannel,
        byPriority,
        byEnvironment: { [env]: scoped.length },
        activeWorkers: workerRuns.filter(
          (r) =>
            r.environment === env &&
            isActiveWorkerRunStatus(r.status) &&
            toMs(r.heartbeatAt) >= tsMs - DEFAULT_HEARTBEAT_STALE_MS
        ).length,
        abandonedWorkerRuns: workerRuns.filter(
          (r) => r.environment === env && r.status === WORKER_RUN_STATUSES.ABANDONED
        ).length,
        generatedAt: nowIso(now),
      };
      return { ok: true, health };
    },

    async cancelDeliveryJob({
      jobId,
      cancelledBy = "ops",
      reason,
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId = null,
      forceLeased = false,
      now = null,
      allowProduction = false,
    } = {}) {
      const env = normalizeNotificationEnvironment(environment);
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
        return { ok: false, error: "production_execution_blocked" };
      }
      const sanitized = redactSecrets(String(reason || "")).slice(0, 240);
      if (!sanitized) return { ok: false, error: "cancellation_reason_required" };
      const idx = findJobIndex(jobId);
      if (idx < 0) return { ok: false, error: "job_not_found" };
      const job = jobs[idx];
      if (normalizeNotificationEnvironment(job.environment || env) !== env) {
        return { ok: false, error: "environment_mismatch" };
      }
      if (tenantId && job.tenantId !== tenantId) {
        return { ok: false, error: "cross_tenant_forbidden" };
      }
      if (
        [
          DELIVERY_JOB_STATES.SENT,
          DELIVERY_JOB_STATES.DEAD_LETTERED,
          DELIVERY_JOB_STATES.CANCELLED,
        ].includes(job.status)
      ) {
        return { ok: false, error: "cancel_rejected_terminal" };
      }
      const ts = nowIso(now);
      const tsMs = toMs(ts);
      if (job.status === DELIVERY_JOB_STATES.PROCESSING) {
        if (job.leaseExpiresAt && toMs(job.leaseExpiresAt) > tsMs && !forceLeased) {
          jobs[idx] = {
            ...job,
            cancelRequested: true,
            cancellationReason: sanitized,
            cancelledBy,
            updatedAt: ts,
          };
          return {
            ok: true,
            cancelRequested: true,
            job: jobs[idx],
          };
        }
      }
      const transition = assertDeliveryJobTransition(job.status, DELIVERY_JOB_STATES.CANCELLED);
      if (!transition.ok) return { ok: false, error: transition.error };
      jobs[idx] = {
        ...job,
        status: DELIVERY_JOB_STATES.CANCELLED,
        cancelRequested: false,
        cancelledAt: ts,
        cancelledBy,
        cancellationReason: sanitized,
        workerId: null,
        claimedAt: null,
        leaseExpiresAt: null,
        claimToken: null,
        processedAt: ts,
        updatedAt: ts,
      };
      return { ok: true, cancelRequested: false, job: jobs[idx] };
    },

    async replayDeliveryJob({
      jobId,
      replayedBy = "ops",
      reason,
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId = null,
      maxReplayCount = DEFAULT_MAX_REPLAY,
      now = null,
    } = {}) {
      const env = normalizeNotificationEnvironment(environment);
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION) {
        return { ok: false, error: "production_replay_blocked_phase16" };
      }
      const sanitized = redactSecrets(String(reason || "")).slice(0, 240);
      if (!sanitized) return { ok: false, error: "replay_reason_required" };
      const idx = findJobIndex(jobId);
      if (idx < 0) return { ok: false, error: "job_not_found" };
      const job = jobs[idx];
      if (normalizeNotificationEnvironment(job.environment || env) !== env) {
        return { ok: false, error: "environment_mismatch" };
      }
      if (tenantId && job.tenantId !== tenantId) {
        return { ok: false, error: "cross_tenant_forbidden" };
      }
      if (
        job.status !== DELIVERY_JOB_STATES.DEAD_LETTERED &&
        job.status !== DELIVERY_JOB_STATES.FAILED
      ) {
        return { ok: false, error: "replay_requires_failed_or_dead_lettered" };
      }
      const nextGen = (job.replayGeneration || 0) + 1;
      if (nextGen > Number(maxReplayCount || DEFAULT_MAX_REPLAY)) {
        return { ok: false, error: "replay_count_exceeded" };
      }
      const active = jobs.find(
        (j) =>
          j.notificationId === job.notificationId &&
          j.channel === job.channel &&
          [
            DELIVERY_JOB_STATES.CREATED,
            DELIVERY_JOB_STATES.QUEUED,
            DELIVERY_JOB_STATES.PROCESSING,
            DELIVERY_JOB_STATES.RETRY_SCHEDULED,
          ].includes(j.status)
      );
      if (active) {
        return { ok: false, error: "active_job_exists_for_channel" };
      }
      const ts = nowIso(now);
      const replay = {
        ...job,
        id: `ndel_replay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: DELIVERY_JOB_STATES.QUEUED,
        attempts: 0,
        lastError: null,
        providerMessageId: null,
        scheduledAt: ts,
        nextAttemptAt: ts,
        workerId: null,
        claimedAt: null,
        leaseExpiresAt: null,
        claimToken: null,
        processedAt: null,
        cancelRequested: false,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        replayedFromJobId: job.id,
        replayRequestedBy: replayedBy,
        replayReason: sanitized,
        replayGeneration: nextGen,
        recoveryCount: 0,
        // Preserve idempotency relationship for in-app
        deliveryIdempotencyKey: job.deliveryIdempotencyKey,
        createdAt: ts,
        updatedAt: ts,
      };
      jobs.unshift(replay);
      jobs[findJobIndex(job.id)] = {
        ...job,
        replayReason: job.replayReason || sanitized,
        updatedAt: ts,
      };
      return { ok: true, job: replay, originalJobId: job.id };
    },

    async recoverStaleLeases({
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId = null,
      runNamespace = null,
      limit = 50,
      staleHeartbeatMs = DEFAULT_HEARTBEAT_STALE_MS,
      now = null,
      allowProduction = false,
    } = {}) {
      const env = normalizeNotificationEnvironment(environment);
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
        return { ok: false, error: "production_execution_blocked", recovered: [] };
      }
      const ts = nowIso(now);
      const tsMs = toMs(ts);
      const recovered = [];
      const max = Math.min(100, Math.max(1, Number(limit) || 50));
      for (const job of [...jobs]) {
        if (recovered.length >= max) break;
        if (normalizeNotificationEnvironment(job.environment || env) !== env) continue;
        if (tenantId && job.tenantId !== tenantId) continue;
        if (runNamespace && job.runNamespace !== runNamespace) continue;
        if (job.status !== DELIVERY_JOB_STATES.PROCESSING) continue;
        if (!job.leaseExpiresAt || toMs(job.leaseExpiresAt) >= tsMs) continue;
        const activeRun = workerRuns.find(
          (r) =>
            r.workerId === job.workerId &&
            r.environment === env &&
            isActiveWorkerRunStatus(r.status) &&
            toMs(r.heartbeatAt) >= tsMs - Number(staleHeartbeatMs)
        );
        if (activeRun) continue;
        const idx = findJobIndex(job.id);
        if (idx < 0) continue;
        const prevWorker = job.workerId;
        const wasCancel = !!job.cancelRequested;
        const nextStatus = wasCancel
          ? DELIVERY_JOB_STATES.CANCELLED
          : (job.attempts || 0) > 0
            ? DELIVERY_JOB_STATES.RETRY_SCHEDULED
            : DELIVERY_JOB_STATES.QUEUED;
        jobs[idx] = {
          ...job,
          status: nextStatus,
          cancelRequested: false,
          cancelledAt: wasCancel ? ts : job.cancelledAt,
          workerId: null,
          claimedAt: null,
          leaseExpiresAt: null,
          claimToken: null,
          recoveryCount: (job.recoveryCount || 0) + 1,
          nextAttemptAt: wasCancel ? job.nextAttemptAt : ts,
          processedAt: wasCancel ? ts : job.processedAt,
          updatedAt: ts,
        };
        recovered.push({
          jobId: job.id,
          previousWorkerId: prevWorker,
          recoveryCount: jobs[idx].recoveryCount,
          status: nextStatus,
        });
      }
      return { ok: true, recovered };
    },

    async cleanupQaRunNamespace({
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace,
      tenantId = null,
      dryRun = true,
      allowProduction = false,
    } = {}) {
      const env = normalizeNotificationEnvironment(environment);
      if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
        return { ok: false, error: "qa_cleanup_disabled_in_production" };
      }
      // Staging cleanup must never target Production jobs
      if (env === NOTIFICATION_ENVIRONMENTS.STAGING || env === NOTIFICATION_ENVIRONMENTS.TEST) {
        const hasProdJobs = jobs.some(
          (j) =>
            normalizeNotificationEnvironment(j.environment) ===
              NOTIFICATION_ENVIRONMENTS.PRODUCTION &&
            j.runNamespace === runNamespace
        );
        if (hasProdJobs) {
          return { ok: false, error: "qa_cleanup_cannot_target_production" };
        }
      }
      if (env !== NOTIFICATION_ENVIRONMENTS.STAGING && env !== NOTIFICATION_ENVIRONMENTS.TEST) {
        return { ok: false, error: "qa_cleanup_staging_only" };
      }
      if (!runNamespace || !isAllowedQaNamespacePrefix(runNamespace)) {
        return { ok: false, error: "invalid_namespace" };
      }
      if (String(runNamespace).includes("%")) {
        return { ok: false, error: "wildcard_namespace_forbidden" };
      }
      const matchJob = (j) =>
        normalizeNotificationEnvironment(j.environment || env) === env &&
        j.runNamespace === runNamespace &&
        (!tenantId || j.tenantId === tenantId);
      const matchInbox = (r) =>
        String(r.idempotencyKey || "").startsWith(runNamespace) &&
        (!tenantId || r.tenantId === tenantId);
      const matchRun = (r) =>
        r.environment === env &&
        r.runNamespace === runNamespace &&
        (!tenantId || !r.tenantId || r.tenantId === tenantId);

      const jobIds = jobs.filter(matchJob).map((j) => j.id);
      const stats = {
        dryRun: !!dryRun,
        environment: env,
        runNamespace,
        jobs: jobIds.length,
        attempts: attempts.filter((a) => jobIds.includes(a.jobId)).length,
        workerRuns: workerRuns.filter(matchRun).length,
        inbox: records.filter(matchInbox).length,
      };
      if (dryRun) return { ok: true, ...stats };

      attempts = attempts.filter((a) => !jobIds.includes(a.jobId));
      jobs = jobs.filter((j) => !matchJob(j));
      workerRuns = workerRuns.filter((r) => !matchRun(r));
      records = records.filter((r) => !matchInbox(r));
      return { ok: true, ...stats, dryRun: false };
    },

    async listDeadLetterJobs({
      environment = NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId = null,
      limit = 20,
    } = {}) {
      const env = normalizeNotificationEnvironment(environment);
      const items = jobs
        .filter((j) => {
          if (normalizeNotificationEnvironment(j.environment || env) !== env) return false;
          if (tenantId && j.tenantId !== tenantId) return false;
          return (
            j.status === DELIVERY_JOB_STATES.DEAD_LETTERED ||
            j.status === DELIVERY_JOB_STATES.FAILED
          );
        })
        .sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt))
        .slice(0, Math.min(100, Math.max(1, Number(limit) || 20)))
        .map((j) => ({
          id: j.id,
          tenantId: j.tenantId,
          channel: j.channel,
          status: j.status,
          environment: j.environment,
          runNamespace: j.runNamespace,
          attempts: j.attempts,
          lastError: j.lastError ? String(j.lastError).slice(0, 200) : null,
          replayGeneration: j.replayGeneration || 0,
          updatedAt: j.updatedAt,
        }));
      return { ok: true, items };
    },

    /** Hydration helpers for localStorage mirror */
    _seedJob(job) {
      if (!job?.id) return;
      const idx = findJobIndex(job.id);
      const normalized = {
        environment: NOTIFICATION_ENVIRONMENTS.STAGING,
        runNamespace: null,
        jobSource: null,
        cancelRequested: false,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        replayedFromJobId: null,
        replayRequestedBy: null,
        replayReason: null,
        replayGeneration: 0,
        recoveryCount: 0,
        ...job,
      };
      if (idx >= 0) jobs[idx] = { ...normalized };
      else jobs.push({ ...normalized });
    },

    _seedAttempt(attempt) {
      if (!attempt) return;
      attempts.push({ ...attempt });
    },

    _seedWorkerRun(run) {
      if (!run?.runId) return;
      const idx = findRunIndex(run.runId);
      if (idx >= 0) workerRuns[idx] = { ...run };
      else workerRuns.push({ ...run });
    },

    /** Test helper */
    _dump() {
      return {
        records: [...records],
        jobs: [...jobs],
        attempts: [...attempts],
        workerRuns: [...workerRuns],
      };
    },

    clear() {
      records = [];
      jobs = [];
      attempts = [];
      workerRuns = [];
    },
  };
}
