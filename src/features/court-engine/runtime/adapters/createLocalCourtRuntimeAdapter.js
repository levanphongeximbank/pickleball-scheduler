/**
 * Explicit localStorage Court runtime adapter (development_local / offline_local only).
 * Must never be selected because durable cloud failed.
 */

import { normalizeCourtSession } from "../../models/courtSession.js";
import {
  buildCourtEngineActiveKey,
  buildCourtEngineStorageKey,
  legacyActiveKey,
  legacyStorageKey,
} from "../../storage/courtEngineStorageKeys.js";
import { COURT_RUNTIME_AUTHORITY } from "../constants.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "../errors.js";

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

function emptyStore(clubId, tenantId) {
  return {
    clubId: String(clubId || ""),
    tenantId: tenantId || null,
    sessions: [],
    updatedAt: new Date().toISOString(),
    cloudVersion: 0,
  };
}

function resolveStorage() {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage;
}

/**
 * @param {{ authority?: string }} [options]
 */
export function createLocalCourtRuntimeAdapter(options = {}) {
  const authority =
    options.authority === COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL
      ? COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL
      : COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL;

  const writeLog = [];

  return {
    authority,
    mode: "local",
    dualWrite: false,
    usesLocalStorage: true,
    writeLog,

    loadRuntime(tenantId, clubId) {
      const storage = resolveStorage();
      if (!storage) {
        return {
          ok: true,
          store: emptyStore(clubId, tenantId),
        };
      }
      const scopedKey = buildCourtEngineStorageKey(clubId, tenantId);
      const scopedRaw = storage.getItem(scopedKey);
      const parsed = scopedRaw
        ? safeParse(scopedRaw, emptyStore(clubId, tenantId))
        : safeParse(storage.getItem(legacyStorageKey(clubId)), emptyStore(clubId, tenantId));
      return {
        ok: true,
        store: {
          clubId: String(clubId),
          tenantId: tenantId || parsed.tenantId || null,
          sessions: (parsed.sessions || []).map(normalizeCourtSession),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          cloudVersion: parsed.cloudVersion ?? 0,
        },
      };
    },

    saveRuntime(tenantId, clubId, store) {
      const storage = resolveStorage();
      if (!storage) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          "localStorage unavailable for local Court runtime adapter."
        );
      }
      const payload = {
        clubId: String(clubId),
        tenantId: String(tenantId),
        sessions: (store.sessions || []).map(normalizeCourtSession),
        updatedAt: new Date().toISOString(),
        cloudVersion: store.cloudVersion ?? 0,
      };
      storage.setItem(buildCourtEngineStorageKey(clubId, tenantId), JSON.stringify(payload));
      writeLog.push({ type: "saveRuntime", tenantId, clubId, sink: "localStorage" });
      return { ok: true, store: payload, authority };
    },

    loadActiveSessionId(tenantId, clubId) {
      const storage = resolveStorage();
      if (!storage) {
        return null;
      }
      return (
        storage.getItem(buildCourtEngineActiveKey(clubId, tenantId)) ||
        storage.getItem(legacyActiveKey(clubId)) ||
        null
      );
    },

    setActiveSessionId(tenantId, clubId, sessionId) {
      const storage = resolveStorage();
      if (!storage) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          "localStorage unavailable for local Court runtime adapter."
        );
      }
      const key = buildCourtEngineActiveKey(clubId, tenantId);
      if (sessionId) {
        storage.setItem(key, String(sessionId));
      } else {
        storage.removeItem(key);
      }
      writeLog.push({
        type: "setActiveSessionId",
        tenantId,
        clubId,
        sessionId,
        sink: "localStorage",
      });
      return { ok: true };
    },
  };
}
