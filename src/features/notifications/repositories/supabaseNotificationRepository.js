import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import { isWorkerOnlyDeliveryJobState } from "../constants/deliveryJobStates.js";
import {
  inboxRecordToRpcArgs,
  rowToDeliveryAttempt,
  rowToDeliveryJob,
  rowToInboxRecord,
  rowToWorkerRun,
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
      runNamespace = null,
      jobSource = null,
    } = {}) {
      const { data, error } = await client.rpc("notification_delivery_enqueue", {
        p_notification_id: notificationId,
        p_tenant_id: tenantId,
        p_channel: channel || "in_app",
        p_run_namespace: runNamespace || null,
        p_job_source: jobSource || null,
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
      environment = null,
      runNamespace = null,
      jobSource = null,
    } = {}) {
      const { data, error } = await client.rpc("notification_delivery_claim_jobs", {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
        p_tenant_id: tenantId,
        p_environment: environment,
        p_run_namespace: runNamespace,
        p_job_source: jobSource,
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

    async startWorkerRun(args = {}) {
      const { data, error } = await client.rpc("notification_worker_run_start", {
        p_run_id: args.runId,
        p_worker_id: args.workerId,
        p_environment: args.environment,
        p_run_namespace: args.runNamespace || null,
        p_tenant_id: args.tenantId || null,
        p_job_source: args.jobSource || null,
        p_batch_size: args.batchSize ?? null,
      });
      if (error) return { ok: false, error: error.message || String(error) };
      return { ok: true, run: rowToWorkerRun(data) };
    },

    async heartbeatWorkerRun({ runId } = {}) {
      const { data, error } = await client.rpc("notification_worker_run_heartbeat", {
        p_run_id: runId,
      });
      if (error) return { ok: false, error: error.message || String(error) };
      return { ok: true, run: rowToWorkerRun(data) };
    },

    async completeWorkerRun({ runId, status, summary = {} } = {}) {
      const { data, error } = await client.rpc("notification_worker_run_complete", {
        p_run_id: runId,
        p_status: status,
        p_claimed_count: summary.claimed ?? 0,
        p_sent_count: summary.sent ?? 0,
        p_retry_scheduled_count: summary.retryScheduled ?? 0,
        p_failed_count: summary.failed ?? 0,
        p_dead_lettered_count: summary.deadLettered ?? 0,
        p_cancelled_count: summary.cancelled ?? 0,
        p_skipped_count: summary.skipped ?? 0,
        p_sanitized_error_count: summary.sanitizedErrorCount ?? 0,
        p_duration_ms: summary.durationMs ?? null,
      });
      if (error) return { ok: false, error: error.message || String(error) };
      return { ok: true, run: rowToWorkerRun(data) };
    },

    async markAbandonedWorkerRuns({ environment = null, staleMs = null } = {}) {
      const { data, error } = await client.rpc("notification_worker_mark_abandoned_runs", {
        p_environment: environment,
        p_stale_seconds: staleMs == null ? null : Math.floor(Number(staleMs) / 1000),
      });
      if (error) return { ok: false, error: error.message || String(error), runs: [] };
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return { ok: true, runs: rows };
    },

    async getQueueHealth({ environment = null, tenantId = null } = {}) {
      const { data, error } = await client.rpc("notification_queue_health", {
        p_environment: environment,
        p_tenant_id: tenantId,
      });
      if (error) {
        return { ok: false, error: error.message || String(error), health: null };
      }
      return { ok: true, health: data };
    },

    async cancelDeliveryJob({
      jobId,
      cancelledBy,
      reason,
      environment = null,
      forceLeased = false,
    } = {}) {
      const { data, error } = await client.rpc("notification_delivery_cancel_job", {
        p_job_id: jobId,
        p_cancelled_by: cancelledBy,
        p_reason: reason,
        p_environment: environment,
        p_force_leased: forceLeased,
      });
      if (error) return { ok: false, error: error.message || String(error) };
      const job = rowToDeliveryJob(data);
      return {
        ok: true,
        cancelRequested: !!job?.cancelRequested && job.status !== "CANCELLED",
        job,
      };
    },

    async replayDeliveryJob({
      jobId,
      replayedBy,
      reason,
      environment = null,
    } = {}) {
      const { data, error } = await client.rpc("notification_delivery_replay_job", {
        p_job_id: jobId,
        p_replayed_by: replayedBy,
        p_reason: reason,
        p_environment: environment,
      });
      if (error) return { ok: false, error: error.message || String(error) };
      return { ok: true, job: rowToDeliveryJob(data), originalJobId: jobId };
    },

    async recoverStaleLeases({
      environment = null,
      tenantId = null,
      runNamespace = null,
      limit = 50,
    } = {}) {
      const { data, error } = await client.rpc(
        "notification_delivery_recover_stale_leases",
        {
          p_environment: environment,
          p_tenant_id: tenantId,
          p_run_namespace: runNamespace,
          p_limit: limit,
        }
      );
      if (error) {
        return { ok: false, error: error.message || String(error), recovered: [] };
      }
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return {
        ok: true,
        recovered: rows.map((r) => ({
          jobId: r.job_id,
          previousWorkerId: r.previous_worker_id,
          recoveryCount: r.recovery_count,
        })),
      };
    },

    async cleanupQaRunNamespace({
      environment,
      runNamespace,
      tenantId = null,
      dryRun = true,
      expectedProjectRef = "qyewbxjsiiyufanzcjcq",
    } = {}) {
      const { data, error } = await client.rpc("notification_qa_cleanup_run_namespace", {
        p_environment: environment,
        p_run_namespace: runNamespace,
        p_tenant_id: tenantId,
        p_expected_project_ref: expectedProjectRef,
        p_dry_run: dryRun !== false,
      });
      if (error) return { ok: false, error: error.message || String(error) };
      return { ok: true, ...(data || {}) };
    },

    async listDeadLetterJobs({
      environment = null,
      tenantId = null,
      limit = 20,
    } = {}) {
      const { data, error } = await client.rpc(
        "notification_delivery_list_dead_letters",
        {
          p_environment: environment,
          p_tenant_id: tenantId,
          p_limit: limit,
        }
      );
      if (error) {
        return { ok: false, error: error.message || String(error), items: [] };
      }
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return {
        ok: true,
        items: rows.map((r) => ({
          id: r.id,
          tenantId: r.tenant_id,
          channel: r.channel,
          status: r.status,
          environment: r.environment,
          runNamespace: r.run_namespace,
          attempts: r.attempts,
          lastError: r.last_error,
          replayGeneration: r.replay_generation,
          updatedAt: r.updated_at,
        })),
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
