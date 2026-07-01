/**
 * Tenant-safe notification dispatch for mobile push/in-app.
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { normalizeRole, rolesEqual } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { can } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import {
  createLocalNotification,
  filterNotificationsByRole,
  getNotificationPreferences,
} from "./notificationService.js";
import {
  EVENT_ROLE_TARGETS,
  EVENT_TO_PREF_TYPE,
  NOTIFICATION_EVENTS,
} from "../constants/notificationEvents.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

const DEV_DISPATCH_LOG_KEY = "pickleball-notification-dispatch-v1";

function loadDevDispatchLog() {
  try {
    const raw = localStorage.getItem(DEV_DISPATCH_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevDispatchLog(entries) {
  localStorage.setItem(DEV_DISPATCH_LOG_KEY, JSON.stringify(entries.slice(-200)));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

export function mapEventToNotificationType(eventType) {
  return EVENT_TO_PREF_TYPE[eventType] || NOTIFICATION_TYPES.CLUB_ANNOUNCEMENT;
}

export function canUserReceiveEvent(user, eventType, { tenantId, payload = {} } = {}) {
  if (!user?.id) {
    return false;
  }

  if (payload.tenantId && payload.tenantId !== tenantId) {
    return false;
  }

  if (user.tenantId && user.tenantId !== tenantId && user.venueId !== tenantId) {
    return false;
  }

  const roleTargets = EVENT_ROLE_TARGETS[eventType];
  if (roleTargets?.length) {
    const normalized = normalizeRole(user.role);
    const allowed = roleTargets.some((role) => rolesEqual(normalized, role));
    if (!allowed) {
      return false;
    }
  }

  const prefType = mapEventToNotificationType(eventType);
  const prefs = getNotificationPreferences();
  if (prefs[prefType] === false) {
    return false;
  }

  if (isRbacEnabled()) {
    const rbacOn = { rbacEnabled: true };
    const scope = { tenantId, venueId: tenantId, clubId: payload.clubId };
    if (eventType === NOTIFICATION_EVENTS.PAYMENT_RECEIVED) {
      return can(user, PERMISSIONS.FINANCE_VIEW, scope, rbacOn);
    }
    if (eventType === NOTIFICATION_EVENTS.SUBSCRIPTION_EXPIRING) {
      return can(user, PERMISSIONS.BILLING_VIEW, scope, rbacOn);
    }
  }

  return true;
}

export function resolveEventRecipients(users, { tenantId, eventType, payload = {} }) {
  return (users || []).filter((user) =>
    canUserReceiveEvent(user, eventType, { tenantId, payload })
  );
}

async function persistNotificationRow(row) {
  if (!hasSupabaseConfig()) {
    return createLocalNotification({
      type: row.type,
      title: row.title,
      body: row.body,
      payload: row.payload_json,
      tenantId: row.tenant_id,
      userId: row.user_id,
    });
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return createLocalNotification({
      type: row.type,
      title: row.title,
      body: row.body,
      payload: row.payload_json,
      tenantId: row.tenant_id,
      userId: row.user_id,
    });
  }

  const { data, error } = await client.from("notifications").insert(row).select("*").single();
  if (error) {
    return createLocalNotification({
      type: row.type,
      title: row.title,
      body: row.body,
      payload: row.payload_json,
      tenantId: row.tenant_id,
      userId: row.user_id,
    });
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(row.title, { body: row.body, tag: row.id, data: row.payload_json });
    } catch {
      // in-app only
    }
  }

  return { ok: true, notification: data };
}

/**
 * Dispatch notification to explicit users — tenant-safe, role-filtered.
 */
export async function dispatchNotification({
  tenantId,
  eventType,
  title,
  body,
  payload = {},
  recipients = [],
} = {}) {
  if (!tenantId || !eventType || !title) {
    return { ok: false, error: "Thiếu tenantId, eventType hoặc title.", code: "INVALID" };
  }

  const type = mapEventToNotificationType(eventType);
  const safePayload = { ...payload, tenantId, eventType };
  const eligible = resolveEventRecipients(recipients, {
    tenantId,
    eventType,
    payload: safePayload,
  });

  if (eligible.length === 0) {
    return { ok: true, dispatched: 0, skipped: recipients.length, reason: "no_eligible_recipients" };
  }

  const results = [];
  for (const user of eligible) {
    const row = {
      tenant_id: tenantId,
      user_id: user.id,
      type,
      title,
      body: body || "",
      payload_json: { ...safePayload, targetUserId: user.id },
      status: "unread",
      read_at: null,
      created_at: new Date().toISOString(),
    };
    const result = await persistNotificationRow(row);
    results.push({ userId: user.id, ...result });
  }

  const logEntry = {
    id: `dispatch-${Date.now()}`,
    tenantId,
    eventType,
    title,
    dispatched: results.filter((r) => r.ok).length,
    skipped: recipients.length - eligible.length,
    createdAt: new Date().toISOString(),
  };
  const log = loadDevDispatchLog();
  log.push(logEntry);
  saveDevDispatchLog(log);

  return {
    ok: true,
    dispatched: logEntry.dispatched,
    skipped: logEntry.skipped,
    results,
  };
}

/** Dispatch to current user only (self notification / test). */
export async function dispatchNotificationToCurrentUser({
  tenantId,
  eventType,
  title,
  body,
  payload = {},
} = {}) {
  const user = getCurrentUser();
  if (!user) {
    return { ok: false, error: "Chưa đăng nhập.", code: "UNAUTHORIZED" };
  }

  if (!canUserReceiveEvent(user, eventType, { tenantId, payload })) {
    return { ok: false, error: "User không đủ quyền nhận thông báo.", code: "FORBIDDEN" };
  }

  return dispatchNotification({
    tenantId,
    eventType,
    title,
    body,
    payload,
    recipients: [user],
  });
}

export function filterDispatchedNotifications(notifications, context) {
  return filterNotificationsByRole(notifications, context);
}

export function getDispatchLogForTenant(tenantId) {
  return loadDevDispatchLog().filter((entry) => entry.tenantId === tenantId);
}

export { NOTIFICATION_EVENTS };
