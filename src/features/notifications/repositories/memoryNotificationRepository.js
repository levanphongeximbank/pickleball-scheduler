import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import {
  DELIVERY_JOB_STATES,
  assertDeliveryJobTransition,
  isTerminalDeliveryJobState,
} from "../constants/deliveryJobStates.js";
import { mapPriorityToQueueRank } from "../utils/deliveryIdempotency.js";

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
 */
export function createMemoryNotificationRepository(seed = []) {
  let records = Array.isArray(seed) ? [...seed] : [];
  let jobs = [];
  let attempts = [];

  function findJobIndex(jobId) {
    return jobs.findIndex((j) => j.id === jobId);
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
    } = {}) {
      const existing = jobs.find(
        (j) => j.notificationId === notificationId && j.channel === channel
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
      now = null,
    } = {}) {
      if (!workerId) {
        return { ok: false, error: "worker_id_required", jobs: [] };
      }
      const ts = nowIso(now);
      const tsMs = toMs(ts);
      const leaseMs = Math.max(5, Number(leaseSeconds) || 60) * 1000;
      const limit = Math.min(50, Math.max(1, Number(batchSize) || 10));

      const eligible = jobs
        .filter((j) => {
          if (tenantId && j.tenantId !== tenantId) return false;
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
        // Re-check lease under "atomic" update
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

        // Expired PROCESSING lease reclaim stays PROCESSING (lease transfer).
        // QUEUED / RETRY_SCHEDULED must transition to PROCESSING.
        if (current.status === DELIVERY_JOB_STATES.PROCESSING) {
          // lease expiry already verified above
        } else {
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
      if (!String(namespacePrefix).startsWith("phase14s:")) {
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

    /** Hydration helpers for localStorage mirror */
    _seedJob(job) {
      if (!job?.id) return;
      const idx = findJobIndex(job.id);
      if (idx >= 0) jobs[idx] = { ...job };
      else jobs.push({ ...job });
    },

    _seedAttempt(attempt) {
      if (!attempt) return;
      attempts.push({ ...attempt });
    },

    /** Test helper */
    _dump() {
      return { records: [...records], jobs: [...jobs], attempts: [...attempts] };
    },

    clear() {
      records = [];
      jobs = [];
      attempts = [];
    },
  };
}
