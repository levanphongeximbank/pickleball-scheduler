/**
 * Phase 1.4 — React hook for canonical inbox (polling-compatible refresh).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  listInbox,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  refreshInbox,
} from "../services/notificationInboxService.js";
import { getNotificationRuntimeStatus } from "./notificationRuntime.js";
import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";

/**
 * @param {object} options
 * @param {string|null} options.tenantId
 * @param {string|null} options.userId
 * @param {number} [options.pollMs]
 * @param {boolean} [options.enabled]
 */
export function useNotificationInbox({
  tenantId = null,
  userId = null,
  pollMs = 5000,
  enabled = true,
} = {}) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runtimeStatus, setRuntimeStatus] = useState(() => getNotificationRuntimeStatus());
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled || !tenantId || !userId) {
      setItems([]);
      setUnreadCount(0);
      setError(null);
      setRuntimeStatus(getNotificationRuntimeStatus());
      return { ok: true, items: [], unreadCount: 0 };
    }
    setLoading(true);
    setRuntimeStatus(getNotificationRuntimeStatus());
    try {
      const result = await refreshInbox({ tenantId, userId });
      if (!mounted.current) return result;
      if (!result.ok) {
        setError(result.error || "Không tải được thông báo.");
        setItems([]);
        setUnreadCount(0);
        return result;
      }
      setError(null);
      setItems(result.items || []);
      setUnreadCount(result.unreadCount || 0);
      return result;
    } catch (err) {
      const message = err?.message || String(err);
      if (mounted.current) {
        setError(message);
      }
      return { ok: false, error: message, items: [], unreadCount: 0 };
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled, tenantId, userId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    if (!enabled || !pollMs || pollMs < 1000) {
      return () => {
        mounted.current = false;
      };
    }
    const id = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [refresh, enabled, pollMs]);

  const markRead = useCallback(
    async (notificationId) => {
      if (!tenantId || !userId || !notificationId) {
        return { ok: false, error: "tenantId, userId, and notificationId are required." };
      }
      const result = await markNotificationRead({
        tenantId,
        userId,
        notificationId,
      });
      if (result.ok) {
        await refresh();
      }
      return result;
    },
    [tenantId, userId, refresh]
  );

  const markAllRead = useCallback(async () => {
    if (!tenantId || !userId) {
      return { ok: false, error: "tenantId and userId are required." };
    }
    const result = await markAllNotificationsRead({ tenantId, userId });
    if (result.ok) {
      await refresh();
    }
    return result;
  }, [tenantId, userId, refresh]);

  const listFiltered = useCallback(
    ({ unreadOnly = false, category = null } = {}) => {
      return (items || []).filter((item) => {
        if (unreadOnly && item.status === NOTIFICATION_STATUSES.READ) return false;
        if (category && item.category !== category) return false;
        return true;
      });
    },
    [items]
  );

  return {
    items,
    unreadCount,
    loading,
    error,
    runtimeStatus,
    refresh,
    markRead,
    markAllRead,
    listFiltered,
    // Direct API passthrough for tests
    listInbox: (opts) => listInbox({ tenantId, userId, ...opts }),
    countUnread: () => countUnreadNotifications({ tenantId, userId }),
  };
}
