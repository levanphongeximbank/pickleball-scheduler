import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPES,
} from "../constants/notificationTypes.js";

const PREFS_KEY = "pickleball-notification-prefs-v1";
const SUBS_KEY = "pickleball-push-subscriptions-v1";
const NOTIFS_KEY = "pickleball-notifications-v1";

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function loadDevSubscriptions() {
  try {
    const raw = localStorage.getItem(SUBS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevSubscriptions(subs) {
  localStorage.setItem(SUBS_KEY, JSON.stringify(subs));
}

function loadDevNotifications() {
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevNotifications(items) {
  localStorage.setItem(NOTIFS_KEY, JSON.stringify(items.slice(-500)));
}

export function getNotificationPermission() {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

export function getNotificationPreferences() {
  return loadPrefs();
}

export function setNotificationPreference(type, enabled) {
  const prefs = loadPrefs();
  prefs[type] = Boolean(enabled);
  savePrefs(prefs);
  return { ok: true, prefs };
}

/** Request permission only when user explicitly opts in. */
export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") {
    return { ok: false, error: "Trình duyệt không hỗ trợ thông báo." };
  }
  if (Notification.permission === "granted") {
    return { ok: true, permission: "granted" };
  }
  if (Notification.permission === "denied") {
    return { ok: false, error: "Quyền thông báo đã bị từ chối.", permission: "denied" };
  }
  const permission = await Notification.requestPermission();
  return { ok: permission === "granted", permission };
}

function subscriptionToRow(subscription, { tenantId, userId, platform }) {
  const keys = subscription.toJSON?.() || subscription;
  return {
    id: `ps-${Date.now()}`,
    tenant_id: tenantId,
    user_id: userId,
    endpoint: keys.endpoint,
    p256dh: keys.keys?.p256dh || "",
    auth: keys.keys?.auth || "",
    platform: platform || "web",
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function subscribeToPush({ tenantId, userId } = {}) {
  const perm = await requestNotificationPermission();
  if (!perm.ok) {
    return perm;
  }

  const user = getCurrentUser();
  const resolvedTenantId = tenantId || user?.venueId || "default-tenant";
  const resolvedUserId = userId || user?.id || "anonymous";

  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: undefined,
      });
      const row = subscriptionToRow(subscription, {
        tenantId: resolvedTenantId,
        userId: resolvedUserId,
        platform: "web",
      });

      if (!hasSupabaseConfig()) {
        const subs = loadDevSubscriptions();
        subs.push(row);
        saveDevSubscriptions(subs);
        return { ok: true, subscription: row, provider: "dev" };
      }

      const client = getSupabaseAuthClient();
      if (client) {
        const { data, error } = await client.from("push_subscriptions").upsert(row).select("*").single();
        if (!error) {
          return { ok: true, subscription: data, provider: "supabase" };
        }
      }

      const subs = loadDevSubscriptions();
      subs.push(row);
      saveDevSubscriptions(subs);
      return { ok: true, subscription: row, provider: "dev-fallback" };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true, provider: "local-only", message: "Push subscription cần HTTPS + VAPID keys." };
}

export async function unsubscribeFromPush({ endpoint } = {}) {
  const user = getCurrentUser();
  if (!hasSupabaseConfig()) {
    const subs = loadDevSubscriptions().filter((s) => s.endpoint !== endpoint);
    saveDevSubscriptions(subs);
    return { ok: true };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }

  let query = client.from("push_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() });
  if (endpoint) {
    query = query.eq("endpoint", endpoint);
  } else if (user?.id) {
    query = query.eq("user_id", user.id);
  }
  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Revoke local + remote push tokens on logout. */
export async function cleanupPushTokensOnLogout() {
  const user = getCurrentUser();
  saveDevSubscriptions([]);
  if (!user?.id || !hasSupabaseConfig()) {
    return { ok: true };
  }
  return unsubscribeFromPush();
}

export async function listNotifications({ tenantId, userId, limit = 50 } = {}) {
  const user = getCurrentUser();
  const resolvedTenantId = tenantId || user?.venueId;
  const resolvedUserId = userId || user?.id;

  if (!hasSupabaseConfig()) {
    let items = loadDevNotifications();
    if (resolvedTenantId) {
      items = items.filter((n) => n.tenant_id === resolvedTenantId);
    }
    if (resolvedUserId) {
      items = items.filter((n) => n.user_id === resolvedUserId);
    }
    return { ok: true, notifications: items.slice(-limit).reverse() };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: true, notifications: loadDevNotifications().slice(-limit).reverse() };
  }

  let query = client.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  if (resolvedTenantId) {
    query = query.eq("tenant_id", resolvedTenantId);
  }
  if (resolvedUserId) {
    query = query.eq("user_id", resolvedUserId);
  }
  const { data, error } = await query;
  if (error) {
    return { ok: true, notifications: loadDevNotifications().slice(-limit).reverse() };
  }
  return { ok: true, notifications: data || [] };
}

export async function createLocalNotification({ type, title, body, payload = {}, tenantId, userId } = {}) {
  const prefs = loadPrefs();
  if (prefs[type] === false) {
    return { ok: false, skipped: true, reason: "disabled" };
  }

  const user = getCurrentUser();
  const row = {
    id: `ntf-${Date.now()}`,
    tenant_id: tenantId || user?.venueId || "default-tenant",
    user_id: userId || user?.id || null,
    type: type || NOTIFICATION_TYPES.CLUB_ANNOUNCEMENT,
    title,
    body,
    payload_json: payload,
    status: "unread",
    read_at: null,
    created_at: new Date().toISOString(),
  };

  const items = loadDevNotifications();
  items.push(row);
  saveDevNotifications(items);

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: row.id, data: payload });
    } catch {
      // ignore — in-app only
    }
  }

  return { ok: true, notification: row };
}

export function markNotificationRead(notificationId) {
  const items = loadDevNotifications();
  const idx = items.findIndex((n) => n.id === notificationId);
  if (idx >= 0) {
    items[idx].status = "read";
    items[idx].read_at = new Date().toISOString();
    saveDevNotifications(items);
  }
  return { ok: true };
}

/** Filter notifications by role scope. */
export function filterNotificationsByRole(notifications, { user, clubId, matchIds = [] }) {
  if (!user) {
    return [];
  }
  const role = user.role;
  if (role === "ADMIN" || role === "VENUE_OWNER") {
    return notifications;
  }
  if (role === "CLUB_OWNER") {
    return notifications.filter(
      (n) => !n.payload_json?.clubId || n.payload_json.clubId === clubId
    );
  }
  if (role === "REFEREE") {
    return notifications.filter(
      (n) =>
        n.type !== NOTIFICATION_TYPES.REFEREE_ASSIGNED ||
        matchIds.includes(n.payload_json?.matchId)
    );
  }
  if (role === "PLAYER") {
    return notifications.filter(
      (n) => !n.user_id || n.user_id === user.id || n.payload_json?.playerId === user.playerId
    );
  }
  return notifications;
}
