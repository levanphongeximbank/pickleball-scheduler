import { normalizeCourtSession } from "../models/courtSession.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { isRbacEnabled } from "../../../auth/authService.js";

const STORAGE_KEY_PREFIX = "pickleball-court-engine-v1";
const ACTIVE_KEY_PREFIX = "pickleball-court-engine-active-v1";

/** Legacy key before Phase 20 tenant scoping (club-only). */
function legacyStorageKey(clubId) {
  return `${STORAGE_KEY_PREFIX}::${clubId}`;
}

function legacyActiveKey(clubId) {
  return `${ACTIVE_KEY_PREFIX}::${clubId}`;
}

function resolveStorageTenantId(clubId, tenantId) {
  const explicit = String(tenantId || "").trim();
  if (explicit) {
    return explicit;
  }

  const fromClub = resolveTenantIdForClub(clubId);
  if (isRbacEnabled() && fromClub === "default-tenant") {
    return "";
  }

  return fromClub || "";
}

export function buildCourtEngineStorageKey(clubId, tenantId) {
  const club = String(clubId || "").trim();
  const tenant = resolveStorageTenantId(club, tenantId);
  if (!club) {
    return `${STORAGE_KEY_PREFIX}::`;
  }
  if (!tenant) {
    return legacyStorageKey(club);
  }
  return `${STORAGE_KEY_PREFIX}::${tenant}::${club}`;
}

export function buildCourtEngineActiveKey(clubId, tenantId) {
  const club = String(clubId || "").trim();
  const tenant = resolveStorageTenantId(club, tenantId);
  if (!club) {
    return `${ACTIVE_KEY_PREFIX}::`;
  }
  if (!tenant) {
    return legacyActiveKey(club);
  }
  return `${ACTIVE_KEY_PREFIX}::${tenant}::${club}`;
}

function safeParse(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function emptyStore(clubId, tenantId = null) {
  return {
    clubId: String(clubId || ""),
    tenantId: resolveStorageTenantId(clubId, tenantId) || null,
    sessions: [],
    updatedAt: new Date().toISOString(),
  };
}

function readStorePayload(clubId, tenantId) {
  const scopedKey = buildCourtEngineStorageKey(clubId, tenantId);
  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw) {
    return safeParse(scopedRaw, emptyStore(clubId, tenantId));
  }

  const legacyRaw = localStorage.getItem(legacyStorageKey(clubId));
  return safeParse(legacyRaw, emptyStore(clubId, tenantId));
}

export function loadCourtEngineStore(clubId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return emptyStore("");
  }

  const parsed = readStorePayload(id, options.tenantId);
  return {
    clubId: id,
    tenantId: resolveStorageTenantId(id, options.tenantId) || parsed.tenantId || null,
    sessions: (parsed.sessions || []).map(normalizeCourtSession),
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
}

export function saveCourtEngineStore(clubId, store, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: false, error: "clubId không hợp lệ." };
  }

  const tenantId = resolveStorageTenantId(id, options.tenantId || store?.tenantId);
  const payload = {
    clubId: id,
    tenantId: tenantId || null,
    sessions: (store.sessions || []).map(normalizeCourtSession),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(buildCourtEngineStorageKey(id, tenantId), JSON.stringify(payload));
  return { ok: true, store: payload };
}

export function loadActiveSessionId(clubId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return null;
  }

  const tenantId = resolveStorageTenantId(id, options.tenantId);
  const scoped = localStorage.getItem(buildCourtEngineActiveKey(id, tenantId));
  if (scoped) {
    return scoped;
  }

  return localStorage.getItem(legacyActiveKey(id)) || null;
}

export function saveActiveSessionId(clubId, sessionId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: false, error: "clubId không hợp lệ." };
  }

  const tenantId = resolveStorageTenantId(id, options.tenantId);
  const key = buildCourtEngineActiveKey(id, tenantId);

  if (sessionId) {
    localStorage.setItem(key, String(sessionId));
  } else {
    localStorage.removeItem(key);
  }

  return { ok: true };
}

export function getSessionFromStore(store, sessionId) {
  return (store.sessions || []).find((item) => String(item.id) === String(sessionId)) || null;
}

export function upsertSessionInStore(store, session) {
  const normalized = normalizeCourtSession(session);
  const sessions = [...(store.sessions || [])];
  const index = sessions.findIndex((item) => String(item.id) === String(normalized.id));

  if (index >= 0) {
    sessions[index] = normalized;
  } else {
    sessions.push(normalized);
  }

  return {
    ...store,
    sessions,
    updatedAt: new Date().toISOString(),
  };
}

/** Export/import helper for pilot backup — does not mutate cloud. */
export function exportCourtEngineStore(clubId, options = {}) {
  const store = loadCourtEngineStore(clubId, options);
  return {
    ok: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    store,
  };
}

export function importCourtEngineStore(clubId, payload, options = {}) {
  if (!payload?.store?.sessions) {
    return { ok: false, error: "Backup không hợp lệ." };
  }
  return saveCourtEngineStore(clubId, payload.store, options);
}
