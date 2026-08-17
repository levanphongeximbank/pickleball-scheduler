import { AUTH_SESSION_KEY, RBAC_STORAGE_KEY, isRbacEnabledFromEnv } from "./config.js";
import { isSecureRuntime } from "./runtime.js";
import { normalizeUser } from "../models/user.js";
import {
  mergeAthleteClubLink,
  reconcileAthleteClubLinkWithProfile,
  clearAthleteClubLink,
} from "../features/club/storage/athleteClubLinkStore.js";
import { syncGovernanceAuthRoleFromClub } from "../features/club/services/governanceRoleElevation.js";
import { isClubStorageV2Enabled } from "../features/club/config/clubRegistryFlags.js";
import { stripLegacyProfileClubFields } from "../features/club/services/clubActiveMembershipService.js";
import { quarantineOfflineQueueOnLogout } from "../features/mobile/services/offlineQueueQuarantine.js";
import { clearActiveTenantId } from "../data/tenantSession.js";
import { clearActiveClubIdPreference } from "../data/club.js";
import { setActiveClusterId } from "../data/courtCluster.js";
import {
  AUTH_SESSION_CLEAR_REASON,
  shouldClearOperationalContextOnAuthClear,
} from "./authSessionLifecycle.js";
import {
  logPlatformContextEvent,
  PLATFORM_CONTEXT_EVENT,
} from "../core/platform/app/platformContextDiagnostics.js";

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
  const fromEnv = isRbacEnabledFromEnv();

  if (isSecureRuntime()) {
    return { enabled: fromEnv };
  }

  const stored = readJson(RBAC_STORAGE_KEY, {});
  return {
    enabled: stored.enabled ?? fromEnv,
  };
}

export function saveRbacConfig(config) {
  if (isSecureRuntime()) {
    return;
  }

  writeJson(RBAC_STORAGE_KEY, {
    enabled: Boolean(config?.enabled),
    updatedAt: new Date().toISOString(),
  });
}

export function loadAuthSession() {
  const session = readJson(AUTH_SESSION_KEY, null);
  if (!session?.user) return null;

  let user = normalizeUser(session.user);

  // Phase 42H — V2: never restore membership from session/profile/athlete-link.
  if (isClubStorageV2Enabled()) {
    if (user.id) {
      clearAthleteClubLink(user.id);
    }
    user = stripLegacyProfileClubFields(user);
  } else {
    user = mergeAthleteClubLink(user);
  }

  const synced = syncGovernanceAuthRoleFromClub(user);
  if (synced.changed) {
    user = synced.user;
    writeJson(AUTH_SESSION_KEY, {
      ...session,
      user,
    });
  }

  return {
    user,
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

/** Lưu session từ profile cloud — V2 strips club_id only; legacy reconciles athlete link. */
export function saveAuthSessionFromCloudProfile(user, meta = {}) {
  let next = normalizeUser(user);
  if (isClubStorageV2Enabled()) {
    if (next?.id) {
      clearAthleteClubLink(next.id);
    }
    next = stripLegacyProfileClubFields(next);
  } else {
    next = reconcileAthleteClubLinkWithProfile(next);
  }
  saveAuthSession(next, meta);
  return next;
}

/**
 * Clear the persisted auth identity.
 *
 * @param {string} [reason=AUTH_SESSION_CLEAR_REASON.LOGOUT]
 *   LOGOUT / USER_SWITCH / AUTH_INVALID → also clear tenant/club/cluster prefs.
 *   IDENTITY_REPLACE → auth key only (F5 / bootstrap must not look like logout).
 */
export function clearAuthSession(reason = AUTH_SESSION_CLEAR_REASON.LOGOUT) {
  const normalized = String(reason || AUTH_SESSION_CLEAR_REASON.LOGOUT).trim();
  const clearOperational = shouldClearOperationalContextOnAuthClear(normalized);

  quarantineOfflineQueueOnLogout();
  if (clearOperational) {
    clearActiveTenantId();
    clearActiveClubIdPreference();
    setActiveClusterId(null);
    logPlatformContextEvent(PLATFORM_CONTEXT_EVENT.CLUB_HINT_CLEARED, {
      reason: normalized,
    });
  }
  logPlatformContextEvent(PLATFORM_CONTEXT_EVENT.AUTH_SESSION_CLEAR, {
    reason: normalized,
    operationalContextCleared: clearOperational,
  });
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export { AUTH_SESSION_CLEAR_REASON };
