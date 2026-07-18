import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import {
  inboxRecordToRpcArgs,
  rowToDeliveryJob,
  rowToInboxRecord,
} from "./notificationRowMap.js";

/**
 * Supabase-backed notification repository (canonical SoT).
 * Uses SECURITY DEFINER RPCs for create/enqueue; direct table for read/update own rows.
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
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();

      if (userId) {
        query = client
          .from("notification_inbox")
          .update({
            status: NOTIFICATION_STATUSES.READ,
            read_at: now,
            updated_at: now,
          })
          .eq("id", notificationId)
          .eq("tenant_id", tenantId)
          .eq("recipient_user_id", userId)
          .select("*")
          .maybeSingle();
      }

      const { data, error } = await query;
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
        alreadyRead: notification.status === NOTIFICATION_STATUSES.READ && !!notification.readAt,
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

    async markDeliveryJobStatus({
      jobId,
      status,
      lastError = null,
      providerMessageId = null,
    } = {}) {
      const { data: current, error: readError } = await client
        .from("notification_delivery_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (readError) {
        return { ok: false, error: readError.message || String(readError) };
      }
      if (!current) {
        return { ok: false, error: "Delivery job not found." };
      }

      const now = new Date().toISOString();
      const { data: updated, error } = await client
        .from("notification_delivery_jobs")
        .update({
          status,
          last_error: lastError,
          provider_message_id: providerMessageId,
          attempts: (current.attempts || 0) + 1,
          processed_at:
            status === "SENT" || status === "FAILED" ? now : current.processed_at,
          updated_at: now,
        })
        .eq("id", jobId)
        .select("*")
        .maybeSingle();

      if (error) {
        return { ok: false, error: error.message || String(error) };
      }

      if (status === "SENT" || status === "FAILED") {
        await client
          .from("notification_inbox")
          .update({ status, updated_at: now })
          .eq("id", updated.notification_id)
          .neq("status", NOTIFICATION_STATUSES.READ);
      }

      return { ok: true, job: rowToDeliveryJob(updated) };
    },
  };
}
