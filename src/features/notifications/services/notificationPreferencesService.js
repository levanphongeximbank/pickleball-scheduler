/**
 * Notification preferences (Phase 1.1 skeleton).
 * Channel delivery is not wired; this returns the canonical preference shape.
 */

const PREFS_KEY = "pickleball-notification-module-prefs-v1";

const DEFAULT_CHANNEL_PREFS = Object.freeze({
  inApp: true,
  email: false,
  sms: false,
  zalo: false,
  push: false,
});

function readPrefsStore() {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function prefsStoreKey(tenantId, userId) {
  return `${tenantId}::${userId || "anonymous"}`;
}

/**
 * @param {{ tenantId: string, userId?: string|null }} input
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   preferences?: {
 *     tenantId: string,
 *     userId: string|null,
 *     channels: { inApp: boolean, email: boolean, sms: boolean, zalo: boolean, push: boolean },
 *     mutedEventTypes: string[],
 *     updatedAt: string|null
 *   }
 * }}
 */
export function getNotificationPreferences({ tenantId, userId = null } = {}) {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required." };
  }

  const store = readPrefsStore();
  const saved = store[prefsStoreKey(tenantId, userId)] || {};

  return {
    ok: true,
    preferences: {
      tenantId: String(tenantId),
      userId: userId ? String(userId) : null,
      channels: {
        ...DEFAULT_CHANNEL_PREFS,
        ...(saved.channels && typeof saved.channels === "object" ? saved.channels : {}),
      },
      mutedEventTypes: Array.isArray(saved.mutedEventTypes)
        ? saved.mutedEventTypes.map(String)
        : [],
      updatedAt: saved.updatedAt || null,
    },
  };
}

export function clearNotificationPreferencesStorage() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PREFS_KEY);
}
