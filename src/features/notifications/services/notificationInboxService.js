import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import {
  loadInboxRecords,
  saveInboxRecords,
} from "../storage/notificationInboxStorage.js";

/**
 * List inbox notification records for a tenant (and optional user filter).
 * @param {{ tenantId: string, userId?: string|null, status?: string|null, limit?: number }} options
 */
export function listInbox({
  tenantId,
  userId = null,
  status = null,
  limit = 100,
} = {}) {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required.", items: [] };
  }

  let items = loadInboxRecords().filter((r) => r.tenantId === tenantId);

  if (userId) {
    items = items.filter((r) => {
      const hints = r.recipientHints || {};
      const userIds = Array.isArray(hints.userIds) ? hints.userIds : [];
      // Empty userIds = broadcast within tenant (skeleton behaviour)
      return userIds.length === 0 || userIds.includes(String(userId));
    });
  }

  if (status) {
    items = items.filter((r) => r.status === status);
  }

  const capped = Math.max(0, Number(limit) || 100);
  return { ok: true, items: items.slice(0, capped) };
}

/**
 * Mark a single notification as READ.
 * @param {{ tenantId: string, notificationId: string, userId?: string|null }} input
 */
export function markNotificationRead({
  tenantId,
  notificationId,
  userId = null,
} = {}) {
  if (!tenantId || !notificationId) {
    return { ok: false, error: "tenantId and notificationId are required." };
  }

  const records = loadInboxRecords();
  const idx = records.findIndex(
    (r) => r.id === notificationId && r.tenantId === tenantId
  );
  if (idx < 0) {
    return { ok: false, error: "Notification not found." };
  }

  const current = records[idx];
  if (userId) {
    const userIds = current.recipientHints?.userIds || [];
    if (userIds.length > 0 && !userIds.includes(String(userId))) {
      return { ok: false, error: "Notification not found for user." };
    }
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
  saveInboxRecords(records);
  return { ok: true, notification: updated, alreadyRead: false };
}

/**
 * Mark all unread inbox notifications for a tenant (and optional user) as READ.
 * @param {{ tenantId: string, userId?: string|null }} input
 */
export function markAllNotificationsRead({ tenantId, userId = null } = {}) {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required.", updatedCount: 0 };
  }

  const records = loadInboxRecords();
  const now = new Date().toISOString();
  let updatedCount = 0;

  const next = records.map((r) => {
    if (r.tenantId !== tenantId) return r;
    if (r.status === NOTIFICATION_STATUSES.READ) return r;

    if (userId) {
      const userIds = r.recipientHints?.userIds || [];
      if (userIds.length > 0 && !userIds.includes(String(userId))) {
        return r;
      }
    }

    updatedCount += 1;
    return {
      ...r,
      status: NOTIFICATION_STATUSES.READ,
      readAt: now,
      updatedAt: now,
    };
  });

  if (updatedCount > 0) {
    saveInboxRecords(next);
  }

  return { ok: true, updatedCount };
}
