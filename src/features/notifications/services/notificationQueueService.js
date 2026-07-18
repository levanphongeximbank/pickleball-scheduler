import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import { getNotificationRepository } from "../repositories/notificationRepository.js";

export const DELIVERY_CHANNELS = Object.freeze({
  IN_APP: "in_app",
  EMAIL: "email",
  SMS: "sms",
  ZALO: "zalo",
  PUSH: "push",
});

export const DELIVERY_JOB_STATUSES = Object.freeze({
  CREATED: NOTIFICATION_STATUSES.CREATED,
  QUEUED: NOTIFICATION_STATUSES.QUEUED,
  SENT: NOTIFICATION_STATUSES.SENT,
  FAILED: NOTIFICATION_STATUSES.FAILED,
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
    status: DELIVERY_JOB_STATUSES.QUEUED,
    limit,
  });
}

/**
 * Mark job terminal status. Does NOT call live providers.
 * Used by future workers / tests.
 */
export async function markDeliveryJobResult({
  jobId,
  status,
  lastError = null,
  providerMessageId = null,
  repository = null,
} = {}) {
  if (!jobId) {
    return { ok: false, error: "jobId is required." };
  }
  if (
    status !== DELIVERY_JOB_STATUSES.SENT &&
    status !== DELIVERY_JOB_STATUSES.FAILED
  ) {
    return { ok: false, error: "status must be SENT or FAILED." };
  }
  const repo = repository || getNotificationRepository();
  return repo.markDeliveryJobStatus({
    jobId,
    status,
    lastError,
    providerMessageId,
  });
}
