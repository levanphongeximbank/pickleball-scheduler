import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";

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

/**
 * In-memory notification repository (tests / default offline).
 */
export function createMemoryNotificationRepository(seed = []) {
  let records = Array.isArray(seed) ? [...seed] : [];
  let jobs = [];

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
    } = {}) {
      const existing = jobs.find(
        (j) => j.notificationId === notificationId && j.channel === channel
      );
      if (existing) {
        return { ok: true, duplicate: true, job: existing };
      }
      const now = new Date().toISOString();
      const job = {
        id: `ndel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        notificationId,
        tenantId,
        channel,
        status: NOTIFICATION_STATUSES.QUEUED,
        attempts: 0,
        lastError: null,
        providerMessageId: null,
        scheduledAt: now,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
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

    async markDeliveryJobStatus({
      jobId,
      status,
      lastError = null,
      providerMessageId = null,
    } = {}) {
      const idx = jobs.findIndex((j) => j.id === jobId);
      if (idx < 0) return { ok: false, error: "Delivery job not found." };
      const now = new Date().toISOString();
      const updated = {
        ...jobs[idx],
        status,
        lastError,
        providerMessageId:
          providerMessageId !== null ? providerMessageId : jobs[idx].providerMessageId,
        attempts: (jobs[idx].attempts || 0) + (status === "FAILED" || status === "SENT" ? 1 : 0),
        processedAt:
          status === "SENT" || status === "FAILED" ? now : jobs[idx].processedAt,
        updatedAt: now,
      };
      jobs[idx] = updated;

      if (status === "SENT" || status === "FAILED") {
        const nIdx = records.findIndex(
          (r) => (r.notificationId || r.id) === updated.notificationId
        );
        if (nIdx >= 0 && records[nIdx].status !== NOTIFICATION_STATUSES.READ) {
          records[nIdx] = {
            ...records[nIdx],
            status,
            updatedAt: now,
          };
        }
      }

      return { ok: true, job: updated };
    },

    /** Test helper */
    _dump() {
      return { records: [...records], jobs: [...jobs] };
    },

    clear() {
      records = [];
      jobs = [];
    },
  };
}
