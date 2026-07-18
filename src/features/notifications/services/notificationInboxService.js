import { getNotificationRepository } from "../repositories/notificationRepository.js";

/**
 * Inbox APIs — backed by Notification Repository (Phase 1.3 SoT).
 */

export async function listInbox({
  tenantId,
  userId = null,
  status = null,
  limit = 100,
  repository = null,
} = {}) {
  const repo = repository || getNotificationRepository();
  return repo.list({ tenantId, userId, status, limit });
}

export async function markNotificationRead({
  tenantId,
  notificationId,
  userId = null,
  repository = null,
} = {}) {
  const repo = repository || getNotificationRepository();
  return repo.markRead({ tenantId, notificationId, userId });
}

export async function markAllNotificationsRead({
  tenantId,
  userId = null,
  repository = null,
} = {}) {
  const repo = repository || getNotificationRepository();
  return repo.markAllRead({ tenantId, userId });
}

export async function countUnreadNotifications({
  tenantId,
  userId = null,
  repository = null,
} = {}) {
  const repo = repository || getNotificationRepository();
  return repo.countUnread({ tenantId, userId });
}
