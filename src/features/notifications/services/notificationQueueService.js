/**
 * Queue + delivery job helpers — Phase 1.5.
 * Enqueue remains available to domain emitters.
 * Claim / terminal state updates are worker-only.
 */

import {
  DELIVERY_JOB_STATES,
  isWorkerOnlyDeliveryJobState,
} from "../constants/deliveryJobStates.js";
import { getNotificationRepository } from "../repositories/notificationRepository.js";

export const DELIVERY_CHANNELS = Object.freeze({
  IN_APP: "in_app",
  EMAIL: "email",
  SMS: "sms",
  ZALO: "zalo",
  PUSH: "push",
});

/** @deprecated Prefer DELIVERY_JOB_STATES from deliveryJobStates.js */
export const DELIVERY_JOB_STATUSES = Object.freeze({
  CREATED: DELIVERY_JOB_STATES.CREATED,
  QUEUED: DELIVERY_JOB_STATES.QUEUED,
  PROCESSING: DELIVERY_JOB_STATES.PROCESSING,
  SENT: DELIVERY_JOB_STATES.SENT,
  RETRY_SCHEDULED: DELIVERY_JOB_STATES.RETRY_SCHEDULED,
  FAILED: DELIVERY_JOB_STATES.FAILED,
  DEAD_LETTERED: DELIVERY_JOB_STATES.DEAD_LETTERED,
  CANCELLED: DELIVERY_JOB_STATES.CANCELLED,
});

/**
 * Queue foundation — enqueue only. No live Email/SMS/Zalo/Push workers.
 */
export async function enqueueNotificationDelivery({
  notificationId,
  tenantId,
  channel = DELIVERY_CHANNELS.IN_APP,
  repository = null,
} = {}) {
  if (!notificationId || !tenantId) {
    return { ok: false, error: "notificationId and tenantId are required." };
  }
  const repo = repository || getNotificationRepository();
  return repo.enqueueDeliveryJob({
    notificationId,
    tenantId,
    channel,
  });
}

export async function listQueuedDeliveryJobs({
  tenantId,
  limit = 100,
  repository = null,
} = {}) {
  const repo = repository || getNotificationRepository();
  return repo.listDeliveryJobs({
    tenantId,
    status: DELIVERY_JOB_STATES.QUEUED,
    limit,
  });
}

/**
 * Mark job terminal status. Does NOT call live providers.
 * Browser callers cannot set worker-only states.
 */
export async function markDeliveryJobResult({
  jobId,
  status,
  lastError = null,
  providerMessageId = null,
  repository = null,
  caller = "worker",
  explicitRetry = false,
} = {}) {
  if (!jobId) {
    return { ok: false, error: "jobId is required." };
  }
  if (caller === "browser" && isWorkerOnlyDeliveryJobState(status)) {
    return {
      ok: false,
      error: "browser_cannot_set_worker_states",
      code: "forbidden",
    };
  }
  const allowed = [
    DELIVERY_JOB_STATES.SENT,
    DELIVERY_JOB_STATES.FAILED,
    DELIVERY_JOB_STATES.RETRY_SCHEDULED,
    DELIVERY_JOB_STATES.DEAD_LETTERED,
    DELIVERY_JOB_STATES.CANCELLED,
  ];
  if (!allowed.includes(status)) {
    return { ok: false, error: "status not allowed for markDeliveryJobResult." };
  }
  const repo = repository || getNotificationRepository();
  return repo.markDeliveryJobStatus({
    jobId,
    status,
    lastError,
    providerMessageId,
    caller,
    explicitRetry,
  });
}
