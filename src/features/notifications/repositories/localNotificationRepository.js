import {
  loadInboxRecords,
  makeIdempotencyIndexKey,
  loadIdempotencyIndex,
  saveIdempotencyIndex,
  saveInboxRecords,
  clearNotificationInboxStorage,
} from "../storage/notificationInboxStorage.js";
import { createMemoryNotificationRepository } from "./memoryNotificationRepository.js";

const JOBS_KEY = "pickleball-notification-delivery-jobs-v1";
const ATTEMPTS_KEY = "pickleball-notification-delivery-attempts-v1";

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

function readAttempts() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAttempts(attempts) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
}

function hydrateMemoryRepo() {
  const repo = createMemoryNotificationRepository(loadInboxRecords());
  for (const job of readJobs()) {
    repo._seedJob(job);
  }
  for (const attempt of readAttempts()) {
    repo._seedAttempt(attempt);
  }
  return repo;
}

function persistRepo(repo) {
  const state = repo._dump();
  saveInboxRecords(state.records);
  writeJobs(state.jobs);
  writeAttempts(state.attempts);
}

/**
 * LocalStorage-backed repository — Phase 1.5 worker methods via hydrated memory.
 */
export function createLocalNotificationRepository() {
  return {
    mode: "local",

    async create(record) {
      const repo = hydrateMemoryRepo();
      const result = await repo.create(record);
      if (!result.duplicate) {
        persistRepo(repo);
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
      return hydrateMemoryRepo().list(filters);
    },

    async getInboxById(input) {
      return hydrateMemoryRepo().getInboxById(input);
    },

    async markRead(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.markRead(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async markAllRead(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.markAllRead(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async countUnread(input) {
      return hydrateMemoryRepo().countUnread(input);
    },

    async findByIdempotencyKey(input) {
      return hydrateMemoryRepo().findByIdempotencyKey(input);
    },

    async enqueueDeliveryJob(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.enqueueDeliveryJob(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async listDeliveryJobs(input) {
      return hydrateMemoryRepo().listDeliveryJobs(input);
    },

    async claimDeliveryJobs(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.claimDeliveryJobs(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async createDeliveryAttempt(attempt) {
      const repo = hydrateMemoryRepo();
      const result = await repo.createDeliveryAttempt(attempt);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async completeDeliveryAttempt(attempt) {
      const repo = hydrateMemoryRepo();
      const result = await repo.completeDeliveryAttempt(attempt);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async listDeliveryAttempts(input) {
      return hydrateMemoryRepo().listDeliveryAttempts(input);
    },

    async completeDeliveryJob(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.completeDeliveryJob(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async markInboxDelivered(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.markInboxDelivered(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async markDeliveryJobStatus(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.markDeliveryJobStatus(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    async cleanupNamespacedQaRows(input) {
      const repo = hydrateMemoryRepo();
      const result = await repo.cleanupNamespacedQaRows(input);
      if (result.ok) persistRepo(repo);
      return result;
    },

    clear() {
      clearNotificationInboxStorage();
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(JOBS_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
      }
    },
  };
}

export function clearLocalDeliveryJobsStorage() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(JOBS_KEY);
  localStorage.removeItem(ATTEMPTS_KEY);
}
