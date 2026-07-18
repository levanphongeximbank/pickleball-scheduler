import {
  loadIdempotencyIndex,
  loadInboxRecords,
  makeIdempotencyIndexKey,
  saveIdempotencyIndex,
  saveInboxRecords,
  clearNotificationInboxStorage,
} from "../storage/notificationInboxStorage.js";
import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import { createMemoryNotificationRepository } from "./memoryNotificationRepository.js";

const JOBS_KEY = "pickleball-notification-delivery-jobs-v1";

function readJobs() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(JOBS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJobs(jobs) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

/**
 * LocalStorage-backed repository — mirrors Phase 1.1/1.2 inbox keys + delivery jobs.
 * Used when Supabase is not configured.
 */
export function createLocalNotificationRepository() {
  const memory = createMemoryNotificationRepository([
    ...loadInboxRecords(),
  ]);

  // Seed jobs from localStorage into memory wrapper by replaying through enqueue is awkward;
  // instead decorate memory methods to sync persistence.

  return {
    mode: "local",

    async create(record) {
      const result = await memory.create(record);
      if (!result.duplicate) {
        const records = loadInboxRecords();
        records.unshift(result.notification);
        saveInboxRecords(records);
        const index = loadIdempotencyIndex();
        index[
          makeIdempotencyIndexKey(
            result.notification.tenantId,
            result.notification.idempotencyKey
          )
        ] = result.notification.notificationId || result.notification.id;
        saveIdempotencyIndex(index);
      }
      return result;
    },

    async list(filters) {
      // Prefer persisted snapshot for list freshness across instances
      const persisted = createMemoryNotificationRepository(loadInboxRecords());
      return persisted.list(filters);
    },

    async markRead(input) {
      const persisted = createMemoryNotificationRepository(loadInboxRecords());
      const result = await persisted.markRead(input);
      if (result.ok) {
        saveInboxRecords(persisted._dump().records);
      }
      return result;
    },

    async markAllRead(input) {
      const persisted = createMemoryNotificationRepository(loadInboxRecords());
      const result = await persisted.markAllRead(input);
      if (result.ok) {
        saveInboxRecords(persisted._dump().records);
      }
      return result;
    },

    async countUnread(input) {
      const persisted = createMemoryNotificationRepository(loadInboxRecords());
      return persisted.countUnread(input);
    },

    async findByIdempotencyKey(input) {
      const persisted = createMemoryNotificationRepository(loadInboxRecords());
      return persisted.findByIdempotencyKey(input);
    },

    async enqueueDeliveryJob(input) {
      const jobs = readJobs();
      const existing = jobs.find(
        (j) =>
          j.notificationId === input.notificationId &&
          j.channel === (input.channel || "in_app")
      );
      if (existing) {
        return { ok: true, duplicate: true, job: existing };
      }
      const now = new Date().toISOString();
      const job = {
        id: `ndel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        notificationId: input.notificationId,
        tenantId: input.tenantId,
        channel: input.channel || "in_app",
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
      writeJobs(jobs);

      const records = loadInboxRecords();
      const idx = records.findIndex(
        (r) => (r.notificationId || r.id) === input.notificationId
      );
      if (idx >= 0 && records[idx].status === NOTIFICATION_STATUSES.CREATED) {
        records[idx] = {
          ...records[idx],
          status: NOTIFICATION_STATUSES.QUEUED,
          updatedAt: now,
        };
        saveInboxRecords(records);
      }

      return { ok: true, duplicate: false, job };
    },

    async listDeliveryJobs({ tenantId, status = null, limit = 100 } = {}) {
      let items = readJobs();
      if (tenantId) items = items.filter((j) => j.tenantId === tenantId);
      if (status) items = items.filter((j) => j.status === status);
      return { ok: true, items: items.slice(0, Math.max(0, Number(limit) || 100)) };
    },

    async markDeliveryJobStatus({
      jobId,
      status,
      lastError = null,
      providerMessageId = null,
    } = {}) {
      const jobs = readJobs();
      const idx = jobs.findIndex((j) => j.id === jobId);
      if (idx < 0) return { ok: false, error: "Delivery job not found." };
      const now = new Date().toISOString();
      const updated = {
        ...jobs[idx],
        status,
        lastError,
        providerMessageId:
          providerMessageId !== null ? providerMessageId : jobs[idx].providerMessageId,
        attempts: (jobs[idx].attempts || 0) + 1,
        processedAt:
          status === "SENT" || status === "FAILED" ? now : jobs[idx].processedAt,
        updatedAt: now,
      };
      jobs[idx] = updated;
      writeJobs(jobs);

      if (status === "SENT" || status === "FAILED") {
        const records = loadInboxRecords();
        const nIdx = records.findIndex(
          (r) => (r.notificationId || r.id) === updated.notificationId
        );
        if (nIdx >= 0 && records[nIdx].status !== NOTIFICATION_STATUSES.READ) {
          records[nIdx] = {
            ...records[nIdx],
            status,
            updatedAt: now,
          };
          saveInboxRecords(records);
        }
      }

      return { ok: true, job: updated };
    },

    clear() {
      clearNotificationInboxStorage();
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(JOBS_KEY);
      }
      memory.clear();
    },
  };
}

export function clearLocalDeliveryJobsStorage() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(JOBS_KEY);
}
