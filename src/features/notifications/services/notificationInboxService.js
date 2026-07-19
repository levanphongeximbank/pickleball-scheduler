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

/**
 * Refresh inbox snapshot (list + unread) from the canonical repository.
 * Used by Header badge, Notification Center, and polling hooks.
 */
export async function refreshInbox({
  tenantId,
  userId = null,
  status = null,
  limit = 100,
  repository = null,
} = {}) {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required.", items: [], unreadCount: 0 };
  }
  if (!userId) {
    return { ok: false, error: "userId is required.", items: [], unreadCount: 0 };
  }

  const repo = repository || getNotificationRepository();
  const [listResult, countResult] = await Promise.all([
    repo.list({ tenantId, userId, status, limit }),
    repo.countUnread({ tenantId, userId }),
  ]);

  if (!listResult.ok) {
    return {
      ok: false,
      error: listResult.error || "Failed to list inbox.",
      items: [],
      unreadCount: 0,
    };
  }
  if (!countResult.ok) {
    return {
      ok: false,
      error: countResult.error || "Failed to count unread.",
      items: listResult.items || [],
      unreadCount: 0,
    };
  }

  return {
    ok: true,
    items: listResult.items || [],
    unreadCount: countResult.count ?? 0,
  };
}
