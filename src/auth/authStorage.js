import { AUTH_SESSION_KEY, RBAC_STORAGE_KEY, isRbacEnabledFromEnv } from "./config.js";
import { normalizeUser } from "../models/user.js";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadRbacConfig() {
  const stored = readJson(RBAC_STORAGE_KEY, {});
  return {
    enabled: stored.enabled ?? isRbacEnabledFromEnv(),
  };
}

export function saveRbacConfig(config) {
  writeJson(RBAC_STORAGE_KEY, {
    enabled: Boolean(config?.enabled),
    updatedAt: new Date().toISOString(),
  });
}

export function loadAuthSession() {
  const session = readJson(AUTH_SESSION_KEY, null);
  if (!session?.user) return null;

  return {
    user: normalizeUser(session.user),
    provider: session.provider || "dev",
    loggedInAt: session.loggedInAt || null,
  };
}

export function saveAuthSession(user, meta = {}) {
  writeJson(AUTH_SESSION_KEY, {
    user: normalizeUser(user),
    provider: meta.provider || "dev",
    loggedInAt: new Date().toISOString(),
  });
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}
