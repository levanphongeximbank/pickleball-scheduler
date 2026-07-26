/**
 * Durable Court runtime adapter — Supabase tables only (no localStorage writes).
 * Tables: court_engine_stores + court_engine_active_sessions (existing SQL).
 */

import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../../auth/authService.js";
import { normalizeCourtSession } from "../../models/courtSession.js";
import { COURT_RUNTIME_AUTHORITY } from "../constants.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "../errors.js";

export const COURT_ENGINE_STORES_TABLE = "court_engine_stores";
export const COURT_ENGINE_ACTIVE_TABLE = "court_engine_active_sessions";

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
 * @param {{
 *   client?: object|null,
 *   getClient?: () => object|null,
 * }} [options]
 */
export function createDurableCourtRuntimeAdapter(options = {}) {
  const memoryCache = new Map();
  const activeCache = new Map();
  const writeLog = [];

  function resolveClient() {
    if (options.client) {
      return options.client;
    }
    if (typeof options.getClient === "function") {
      return options.getClient();
    }
    if (!hasSupabaseConfig()) {
      return null;
    }
    return getSupabaseAuthClient();
  }

  function unavailable(message, details) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_DURABLE_STORE_UNAVAILABLE,
      message || "Court durable store unavailable.",
      details
    );
  }

  function cacheGet(tenantId, clubId) {
    return memoryCache.get(scopeKey(tenantId, clubId)) || null;
  }

  function cacheSet(tenantId, clubId, store) {
    memoryCache.set(scopeKey(tenantId, clubId), store);
  }

  return {
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    mode: "durable",
    dualWrite: false,
    usesLocalStorage: false,
    writeLog,

    /**
     * Sync read from in-process cache (populated by hydrate / prior save).
     * Does not touch localStorage.
     */
    loadRuntime(tenantId, clubId) {
      const cached = cacheGet(tenantId, clubId);
      if (cached) {
        return {
          ok: true,
          store: {
            ...cached,
            sessions: (cached.sessions || []).map(normalizeCourtSession),
          },
          source: "memory_cache",
        };
      }
      return {
        ok: true,
        store: emptyStore(clubId, tenantId),
        source: "empty",
      };
    },

    /**
     * Async durable load from Supabase. Fail-closed when store unavailable.
     */
    async hydrateRuntime(tenantId, clubId) {
      const supabase = resolveClient();
      if (!supabase) {
        return unavailable("Supabase client unavailable for durable Court runtime.", {
          code: "NO_SUPABASE",
        });
      }

      const { data: storeRow, error: storeError } = await supabase
        .from(COURT_ENGINE_STORES_TABLE)
        .select("payload, version, updated_at")
        .eq("tenant_id", tenantId)
        .eq("club_id", clubId)
        .maybeSingle();

      if (storeError) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          storeError.message || "Durable Court runtime pull failed.",
          { code: "PULL_FAILED" }
        );
      }

      const { data: activeRow, error: activeError } = await supabase
        .from(COURT_ENGINE_ACTIVE_TABLE)
        .select("session_id, updated_at")
        .eq("tenant_id", tenantId)
        .eq("club_id", clubId)
        .maybeSingle();

      if (activeError) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          activeError.message || "Durable active session pull failed.",
          { code: "PULL_ACTIVE_FAILED" }
        );
      }

      if (!storeRow?.payload) {
        const empty = emptyStore(clubId, tenantId);
        cacheSet(tenantId, clubId, empty);
        if (activeRow?.session_id) {
          activeCache.set(scopeKey(tenantId, clubId), String(activeRow.session_id));
        }
        return { ok: true, found: false, store: empty };
      }

      const store = {
        clubId,
        tenantId,
        sessions: (storeRow.payload.sessions || []).map(normalizeCourtSession),
        updatedAt: storeRow.updated_at || new Date().toISOString(),
        cloudVersion: storeRow.version ?? 1,
      };
      cacheSet(tenantId, clubId, store);
      if (activeRow?.session_id) {
        activeCache.set(scopeKey(tenantId, clubId), String(activeRow.session_id));
      } else {
        activeCache.delete(scopeKey(tenantId, clubId));
      }

      writeLog.push({ type: "hydrateRuntime", tenantId, clubId, sink: "supabase" });
      return {
        ok: true,
        found: true,
        store,
        activeSessionId: activeRow?.session_id || null,
        version: store.cloudVersion,
      };
    },

    /**
     * Durable save — awaits Supabase upsert. Never writes localStorage.
     * On failure returns typed error (caller must not report success).
     */
    async saveRuntime(tenantId, clubId, store, saveOptions = {}) {
      const supabase = resolveClient();
      if (!supabase) {
        return unavailable("Supabase client unavailable for durable Court runtime write.", {
          code: "NO_SUPABASE",
        });
      }

      const previous = cacheGet(tenantId, clubId);
      const expectedVersion = Number(
        saveOptions.expectedVersion ?? store.cloudVersion ?? previous?.cloudVersion ?? 0
      );
      const nextVersion = expectedVersion + 1;
      const user = getCurrentUser();
      const payload = {
        clubId,
        tenantId,
        sessions: (store.sessions || []).map(normalizeCourtSession),
        updatedAt: new Date().toISOString(),
      };

      const { data: existing, error: readError } = await supabase
        .from(COURT_ENGINE_STORES_TABLE)
        .select("version")
        .eq("tenant_id", tenantId)
        .eq("club_id", clubId)
        .maybeSingle();

      if (readError) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          readError.message || "Durable Court runtime read failed.",
          { code: "READ_FAILED" }
        );
      }

      if (existing && Number(existing.version) > expectedVersion) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          "Dữ liệu đã được cập nhật bởi người khác — tải lại.",
          { code: "VERSION_CONFLICT", remoteVersion: existing.version }
        );
      }

      const { data, error } = await supabase
        .from(COURT_ENGINE_STORES_TABLE)
        .upsert(
          {
            tenant_id: tenantId,
            club_id: clubId,
            payload,
            version: nextVersion,
            updated_at: new Date().toISOString(),
            updated_by: user?.id || null,
          },
          { onConflict: "tenant_id,club_id" }
        )
        .select("version, updated_at")
        .maybeSingle();

      if (error) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          error.message || "Durable Court runtime write failed.",
          { code: "PUSH_FAILED" }
        );
      }

      const nextStore = {
        ...payload,
        cloudVersion: data?.version ?? nextVersion,
        updatedAt: data?.updated_at || payload.updatedAt,
      };
      cacheSet(tenantId, clubId, nextStore);
      writeLog.push({ type: "saveRuntime", tenantId, clubId, sink: "supabase" });
      return {
        ok: true,
        store: nextStore,
        authority: COURT_RUNTIME_AUTHORITY.DURABLE,
        version: nextStore.cloudVersion,
      };
    },

    loadActiveSessionId(tenantId, clubId) {
      return activeCache.get(scopeKey(tenantId, clubId)) || null;
    },

    async setActiveSessionId(tenantId, clubId, sessionId) {
      const supabase = resolveClient();
      if (!supabase) {
        return unavailable("Supabase client unavailable for durable active session write.", {
          code: "NO_SUPABASE",
        });
      }

      const key = scopeKey(tenantId, clubId);
      if (!sessionId) {
        activeCache.delete(key);
        const { error } = await supabase
          .from(COURT_ENGINE_ACTIVE_TABLE)
          .delete()
          .eq("tenant_id", tenantId)
          .eq("club_id", clubId);
        if (error) {
          return createCourtRuntimeError(
            COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
            error.message || "Durable clear active session failed.",
            { code: "PUSH_ACTIVE_FAILED" }
          );
        }
        writeLog.push({ type: "clearActiveSessionId", tenantId, clubId, sink: "supabase" });
        return { ok: true };
      }

      const { error } = await supabase.from(COURT_ENGINE_ACTIVE_TABLE).upsert(
        {
          tenant_id: tenantId,
          club_id: clubId,
          session_id: String(sessionId),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,club_id" }
      );
      if (error) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
          error.message || "Durable active session write failed.",
          { code: "PUSH_ACTIVE_FAILED" }
        );
      }
      activeCache.set(key, String(sessionId));
      writeLog.push({
        type: "setActiveSessionId",
        tenantId,
        clubId,
        sessionId,
        sink: "supabase",
      });
      return { ok: true };
    },

    /** Sync cache-only active set — only after durable write succeeded. */
    setActiveSessionIdCached(tenantId, clubId, sessionId) {
      const key = scopeKey(tenantId, clubId);
      if (sessionId) {
        activeCache.set(key, String(sessionId));
      } else {
        activeCache.delete(key);
      }
      return { ok: true };
    },

    clearCache() {
      memoryCache.clear();
      activeCache.clear();
      writeLog.length = 0;
    },
  };
}
