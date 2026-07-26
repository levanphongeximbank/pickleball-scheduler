/**
 * Court Engine storage — demoted localStorage compatibility layer (BM-FINAL-COURT-01).
 *
 * Canonical writes go through `src/features/court-engine/runtime/`.
 * localStorage writes are allowed only under explicit local authority.
 * No dual-write / fire-and-forget cloud push from this module.
 */

import { normalizeCourtSession } from "../models/courtSession.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import {
  assertLocalStorageWriteAllowed,
  getCourtRuntimeWriter,
  isLocalCourtRuntimeAuthority,
} from "../runtime/composition.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "../runtime/errors.js";
import {
  buildCourtEngineActiveKey,
  buildCourtEngineStorageKey,
  legacyActiveKey,
  legacyStorageKey,
} from "./courtEngineStorageKeys.js";
import {
  createSupabaseCourtEngineStore,
  isSupabaseCourtEngineStoreEnabled,
} from "./SupabaseCourtEngineStore.js";

export {
  buildCourtEngineActiveKey,
  buildCourtEngineStorageKey,
  legacyActiveKey,
  legacyStorageKey,
} from "./courtEngineStorageKeys.js";

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
    cloudVersion: 0,
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

/**
 * Compatibility read. Prefer runtime writer when available.
 * Legacy localStorage read retained for migration / explicit local mode.
 */
export function loadCourtEngineStore(clubId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return emptyStore("");
  }

  const runtime = getCourtRuntimeWriter(options.runtime || {});
  if (runtime.ok && !isLocalCourtRuntimeAuthority(runtime.authority)) {
    const loaded = runtime.writer.loadRuntime({
      tenantId: resolveStorageTenantId(id, options.tenantId),
      clubId: id,
    });
    if (loaded.ok) {
      return loaded.store;
    }
  }

  if (typeof localStorage === "undefined") {
    return emptyStore(id, options.tenantId);
  }

  const parsed = readStorePayload(id, options.tenantId);
  return {
    clubId: id,
    tenantId: resolveStorageTenantId(id, options.tenantId) || parsed.tenantId || null,
    sessions: (parsed.sessions || []).map(normalizeCourtSession),
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    cloudVersion: parsed.cloudVersion ?? 0,
  };
}

/**
 * Demoted local writer — explicit local authority required.
 * Does NOT push to cloud (no dual-write).
 */
export function saveCourtEngineStore(clubId, store, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: false, error: "clubId không hợp lệ." };
  }

  const allowed = assertLocalStorageWriteAllowed();
  if (!allowed.ok) {
    return allowed;
  }

  const tenantId = resolveStorageTenantId(id, options.tenantId || store?.tenantId);
  if (!tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "tenantId is required for Court Engine local writes."
    );
  }

  const payload = {
    clubId: id,
    tenantId: tenantId || null,
    sessions: (store.sessions || []).map(normalizeCourtSession),
    updatedAt: new Date().toISOString(),
    cloudVersion: store.cloudVersion ?? 0,
  };

  localStorage.setItem(buildCourtEngineStorageKey(id, tenantId), JSON.stringify(payload));
  return { ok: true, store: payload, authority: allowed.authority };
}

export function loadActiveSessionId(clubId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return null;
  }

  const runtime = getCourtRuntimeWriter(options.runtime || {});
  if (runtime.ok && !isLocalCourtRuntimeAuthority(runtime.authority)) {
    const tenantId = resolveStorageTenantId(id, options.tenantId);
    if (tenantId) {
      return runtime.writer.adapter.loadActiveSessionId(tenantId, id);
    }
  }

  if (typeof localStorage === "undefined") {
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

  const allowed = assertLocalStorageWriteAllowed();
  if (!allowed.ok) {
    return allowed;
  }

  const tenantId = resolveStorageTenantId(id, options.tenantId);
  if (!tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "tenantId is required for Court Engine active session local writes."
    );
  }

  const key = buildCourtEngineActiveKey(id, tenantId);
  if (sessionId) {
    localStorage.setItem(key, String(sessionId));
  } else {
    localStorage.removeItem(key);
  }

  return { ok: true, authority: allowed.authority };
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

/** Export/import helper for pilot backup — local mode only. */
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

export function getCourtEngineStoreMode() {
  const runtime = getCourtRuntimeWriter();
  if (runtime.ok) {
    return runtime.authority === "durable" ? "supabase" : "local";
  }
  return String(import.meta.env?.VITE_COURT_ENGINE_STORE || "local").toLowerCase();
}

/** Factory — authority-aware; does not auto-select local on cloud failure. */
export function resolveCourtEngineStore(client, options = {}) {
  const runtime = getCourtRuntimeWriter({
    ...options.runtime,
    client,
    authority: options.authority,
    env: options.env,
  });

  if (!runtime.ok) {
    return {
      mode: "unavailable",
      error: runtime,
      loadCourtEngineStore: () => emptyStore(""),
      saveCourtEngineStore: () => runtime,
      loadActiveSessionId: () => null,
      saveActiveSessionId: () => runtime,
      getSessionFromStore,
      upsertSessionInStore,
    };
  }

  if (runtime.authority === "durable") {
    return createSupabaseCourtEngineStore(client, {
      tenantId: options.tenantId,
      writer: runtime.writer,
    });
  }

  return {
    mode: "local",
    authority: runtime.authority,
    loadCourtEngineStore: (clubId) => loadCourtEngineStore(clubId, options),
    saveCourtEngineStore: (clubId, store) => saveCourtEngineStore(clubId, store, options),
    loadActiveSessionId: (clubId) => loadActiveSessionId(clubId, options),
    saveActiveSessionId: (clubId, sessionId) => saveActiveSessionId(clubId, sessionId, options),
    getSessionFromStore,
    upsertSessionInStore,
  };
}

export { createSupabaseCourtEngineStore, isSupabaseCourtEngineStoreEnabled };
