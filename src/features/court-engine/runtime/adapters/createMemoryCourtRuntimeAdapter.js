/**
 * In-memory Court runtime adapter (explicit TEST_MEMORY only).
 */

import { normalizeCourtSession } from "../../models/courtSession.js";
import { COURT_RUNTIME_AUTHORITY } from "../constants.js";

function emptyStore(clubId, tenantId) {
  return {
    clubId: String(clubId || ""),
    tenantId: tenantId || null,
    sessions: [],
    updatedAt: new Date().toISOString(),
    cloudVersion: 0,
  };
}

function scopeKey(tenantId, clubId) {
  return `${String(tenantId || "").trim()}::${String(clubId || "").trim()}`;
}

/**
 * @param {{ authority?: string }} [options]
 */
export function createMemoryCourtRuntimeAdapter() {
  const stores = new Map();
  const activeIds = new Map();
  const writeLog = [];

  return {
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
    mode: "memory",
    dualWrite: false,
    usesLocalStorage: false,
    writeLog,

    loadRuntime(tenantId, clubId) {
      const key = scopeKey(tenantId, clubId);
      const store = stores.get(key) || emptyStore(clubId, tenantId);
      return {
        ok: true,
        store: {
          ...store,
          sessions: (store.sessions || []).map(normalizeCourtSession),
        },
      };
    },

    saveRuntime(tenantId, clubId, store) {
      const key = scopeKey(tenantId, clubId);
      const payload = {
        clubId: String(clubId),
        tenantId: String(tenantId),
        sessions: (store.sessions || []).map(normalizeCourtSession),
        updatedAt: new Date().toISOString(),
        cloudVersion: store.cloudVersion ?? 0,
      };
      stores.set(key, payload);
      writeLog.push({ type: "saveRuntime", tenantId, clubId });
      return { ok: true, store: payload, authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY };
    },

    loadActiveSessionId(tenantId, clubId) {
      return activeIds.get(scopeKey(tenantId, clubId)) || null;
    },

    setActiveSessionId(tenantId, clubId, sessionId) {
      const key = scopeKey(tenantId, clubId);
      if (sessionId) {
        activeIds.set(key, String(sessionId));
      } else {
        activeIds.delete(key);
      }
      writeLog.push({ type: "setActiveSessionId", tenantId, clubId, sessionId });
      return { ok: true };
    },

    clear() {
      stores.clear();
      activeIds.clear();
      writeLog.length = 0;
    },
  };
}
