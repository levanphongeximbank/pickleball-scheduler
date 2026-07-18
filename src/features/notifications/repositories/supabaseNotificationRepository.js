import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import { isWorkerOnlyDeliveryJobState } from "../constants/deliveryJobStates.js";
import {
  inboxRecordToRpcArgs,
  rowToDeliveryAttempt,
  rowToDeliveryJob,
  rowToInboxRecord,
} from "./notificationRowMap.js";

/**
 * Supabase-backed notification repository (canonical SoT).
 * Create/enqueue via SECURITY DEFINER RPCs.
 * Claim/complete require service_role client (worker only).
 */
export function createSupabaseNotificationRepository(client) {
  if (!client) {
    throw new Error("Supabase client required for notification repository");
  }

  return {
    mode: "supabase",
    client,

    async create(record) {
      const existing = await this.findByIdempotencyKey({
        tenantId: record.tenantId,
        idempotencyKey: record.idempotencyKey,
      });
      if (existing.notification) {
        return {
          ok: true,
          duplicate: true,
          notification: existing.notification,
        };
      }

      const args = inboxRecordToRpcArgs(record);
      const { data, error } = await client.rpc("notification_inbox_create", args);
      if (error) {
        return { ok: false, error: error.message || String(error) };
      }
      const notification = rowToInboxRecord(data);
      return { ok: true, duplicate: false, notification };
    },

    async list({ tenantId, userId = null, status = null, limit = 100 } = {}) {
      if (!tenantId) {
        return { ok: false, error: "tenantId is required.", items: [] };
      }
      let query = client
        .from("notification_inbox")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(Math.max(0, Number(limit) || 100));

      if (userId) {
        query = query.eq("recipient_user_id", userId);
      }
      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) {
        return { ok: false, error: error.message || String(error), items: [] };
      }
      return {
        ok: true,
        items: (data || []).map(rowToInboxRecord),
      };
    },

    async getInboxById({ notificationId, tenantId } = {}) {
      if (!notificationId) return { ok: true, notification: null };
      let query = client
        .from("notification_inbox")
        .select("*")
        .eq("id", notificationId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        return { ok: false, error: error.message || String(error), notification: null };
      }
      return { ok: true, notification: rowToInboxRecord(data) };
    },

    async markRead({ tenantId, notificationId, userId = null } = {}) {
      if (!tenantId || !notificationId) {
        return { ok: false, error: "tenantId and notificationId are required." };
      }
      const now = new Date().toISOString();
      let query = client
        .from("notification_inbox")
        .update({
          status: NOTIFICATION_STATUSES.READ,
          read_at: now,
          updated_at: now,
        })
        .eq("id", notificationId)
        .eq("tenant_id", tenantId);

      if (userId) {
        query = query.eq("recipient_user_id", userId);
      }

      const { data, error } = await query.select("*").maybeSingle();
      if (error) {
        return { ok: false, error: error.message || String(error) };
      }
      if (!data) {
        return { ok: false, error: "Notification not found." };
      }
      const notification = rowToInboxRecord(data);
      return {
        ok: true,
        notification,
        alreadyRead:
          notification.status === NOTIFICATION_STATUSES.READ && !!notification.readAt,
      };
    },

    async markAllRead({ tenantId, userId = null } = {}) {
      if (!tenantId) {
        return { ok: false, error: "tenantId is required.", updatedCount: 0 };
      }
      const now = new Date().toISOString();
      let query = client
        .from("notification_inbox")
        .update({
          status: NOTIFICATION_STATUSES.READ,
          read_at: now,
          updated_at: now,
        })
        .eq("tenant_id", tenantId)
        .neq("status", NOTIFICATION_STATUSES.READ)
        .select("id");

      if (userId) {
        query = query.eq("recipient_user_id", userId);
      }

      const { data, error } = await query;
      if (error) {
        return { ok: false, error: error.message || String(error), updatedCount: 0 };
      }
      return { ok: true, updatedCount: (data || []).length };
    },

    async countUnread({ tenantId, userId = null } = {}) {
      if (!tenantId) {
        return { ok: false, error: "tenantId is required.", count: 0 };
      }
      let query = client
        .from("notification_inbox")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .neq("status", NOTIFICATION_STATUSES.READ);

      if (userId) {
        query = query.eq("recipient_user_id", userId);
      }

      const { count, error } = await query;
      if (error) {
        return { ok: false, error: error.message || String(error), count: 0 };
      }
      return { ok: true, count: count || 0 };
    },

    async findByIdempotencyKey({ tenantId, idempotencyKey } = {}) {
      if (!tenantId || !idempotencyKey) {
        return { ok: true, notification: null };
      }
      const { data, error } = await client
        .from("notification_inbox")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message || String(error), notification: null };
      }
      return { ok: true, notification: rowToInboxRecord(data) };
    },

    async enqueueDeliveryJob({
      notificationId,
      tenantId,
      channel = "in_app",
    } = {}) {
      const { data, error } = await client.rpc("notification_delivery_enqueue", {
        p_notification_id: notificationId,
        p_tenant_id: tenantId,
        p_channel: channel || "in_app",
      });
      if (error) {
        return { ok: false, error: error.message || String(error) };
      }
      return { ok: true, duplicate: false, job: rowToDeliveryJob(data) };
    },

    async listDeliveryJobs({ tenantId, status = null, limit = 100 } = {}) {
      let query = client
        .from("notification_delivery_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(Math.max(0, Number(limit) || 100));
      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) {
        return { ok: false, error: error.message || String(error), items: [] };
      }
      return { ok: true, items: (data || []).map(rowToDeliveryJob) };
    },

    async claimDeliveryJobs({
      workerId,
      batchSize = 10,
      leaseSeconds = 60,
      tenantId = null,
    } = {}) {
      const { data, error } = await client.rpc("notification_delivery_claim_jobs", {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
        p_tenant_id: tenantId,
      });
      if (error) {
        return { ok: false, error: error.message || String(error), jobs: [] };
      }
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return { ok: true, jobs: rows.map(rowToDeliveryJob) };
    },

    async createDeliveryAttempt(attempt) {
      return this.completeDeliveryAttempt(attempt);
    },

    async completeDeliveryAttempt(attempt) {
      const { data, error } = await client.rpc("notification_delivery_record_attempt", {
        p_job_id: attempt.jobId,
        p_attempt_number: attempt.attemptNumber,
        p_worker_id: attempt.workerId,
        p_channel: attempt.channel,
        p_provider: attempt.provider,
        p_result: attempt.result || "STARTED",
        p_error_code: attempt.errorCode || null,
        p_sanitized_error_message: attempt.sanitizedErrorMessage || null,
        p_retryable: !!attempt.retryable,
        p_next_attempt_at: attempt.nextAttemptAt || null,
        p_provider_message_id: attempt.providerMessageId || null,
        p_delivery_mode: attempt.deliveryMode || "sandbox",
        p_started_at: attempt.startedAt || null,
        p_completed_at: attempt.completedAt || null,
      });
      if (error) {
        return { ok: false, error: error.message || String(error) };
      }
      return { ok: true, attempt: rowToDeliveryAttempt(data) };
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
      const { data, error } = await client.rpc("notification_delivery_complete_job", {
        p_job_id: jobId,
        p_claim_token: claimToken,
        p_worker_id: workerId,
        p_status: status,
        p_provider_message_id: providerMessageId,
        p_last_error: lastError,
        p_next_attempt_at: nextAttemptAt,
        p_delivery_mode: deliveryMode,
        p_delivery_idempotency_key: deliveryIdempotencyKey,
        p_attempt_number: attemptNumber,
        p_explicit_retry: explicitRetry,
      });
      if (error) {
        return { ok: false, error: error.message || String(error) };
      }
      return { ok: true, job: rowToDeliveryJob(data) };
    },

    async markInboxDelivered({ notificationId, tenantId } = {}) {
      const now = new Date().toISOString();
      let query = client
        .from("notification_inbox")
        .update({ status: NOTIFICATION_STATUSES.SENT, updated_at: now })
        .eq("id", notificationId)
        .neq("status", NOTIFICATION_STATUSES.READ);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data, error } = await query.select("*").maybeSingle();
      if (error) {
        return { ok: false, error: error.message || String(error) };
      }
      return { ok: true, notification: rowToInboxRecord(data) };
    },

    async cleanupNamespacedQaRows({
      tenantId,
      namespacePrefix,
      ids = [],
      expectedProjectRef = "qyewbxjsiiyufanzcjcq",
    } = {}) {
      const { data, error } = await client.rpc(
        "notification_qa_cleanup_namespaced_inbox",
        {
          p_tenant_id: tenantId,
          p_namespace_prefix: namespacePrefix,
          p_ids: ids,
          p_expected_project_ref: expectedProjectRef,
        }
      );
      if (error) {
        return { ok: false, error: error.message || String(error), deleted: 0 };
      }
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return {
        ok: true,
        deleted: rows.length,
        ids: rows.map((r) => r.deleted_id || r),
      };
    },

    async markDeliveryJobStatus({
      jobId,
      status,
      caller = "worker",
    } = {}) {
      if (caller === "browser" && isWorkerOnlyDeliveryJobState(status)) {
        return {
          ok: false,
          error: "browser_cannot_set_worker_states",
          code: "forbidden",
        };
      }
      if (caller === "browser") {
        return {
          ok: false,
          error: "browser_cannot_mutate_delivery_jobs",
          code: "forbidden",
        };
      }
      return {
        ok: false,
        error: "use_completeDeliveryJob_with_claim",
        code: "forbidden",
        hint: { jobId, status },
      };
    },
  };
}
