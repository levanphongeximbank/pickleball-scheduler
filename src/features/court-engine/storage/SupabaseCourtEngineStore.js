/**
 * Supabase court engine store — Phase 30 stub.
 * Implements the same surface as local courtEngineStorage helpers.
 * Reads VITE_COURT_ENGINE_STORE; falls back to localStorage when unavailable.
 */
import {
  buildCourtEngineActiveKey,
  buildCourtEngineStorageKey,
  getSessionFromStore as localGetSessionFromStore,
  loadActiveSessionId as localLoadActiveSessionId,
  loadCourtEngineStore as localLoadCourtEngineStore,
  saveActiveSessionId as localSaveActiveSessionId,
  saveCourtEngineStore as localSaveCourtEngineStore,
  upsertSessionInStore as localUpsertSessionInStore,
} from "./courtEngineStorage.js";

const TABLE = "court_engine_stores";

function resolveStoreMode() {
  return String(import.meta.env?.VITE_COURT_ENGINE_STORE || "local").toLowerCase();
}

export function isSupabaseCourtEngineStoreEnabled() {
  return resolveStoreMode() === "supabase";
}

export function createSupabaseCourtEngineStore(client, { tenantId = "" } = {}) {
  const cache = new Map();

  async function hydrate(clubId) {
    const id = String(clubId || "").trim();
    if (!id) return localLoadCourtEngineStore("");
    if (!client) {
      return localLoadCourtEngineStore(id, { tenantId });
    }

    const cacheKey = `${tenantId}::${id}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    try {
      const query = client.from(TABLE).select("club_id, tenant_id, payload, updated_at").eq("club_id", id);
      const { data, error } = tenantId ? await query.eq("tenant_id", tenantId).maybeSingle() : await query.maybeSingle();
      if (error) throw error;
      const store = data?.payload
        ? { ...data.payload, clubId: id, tenantId: data.tenant_id || tenantId || null }
        : localLoadCourtEngineStore(id, { tenantId });
      cache.set(cacheKey, store);
      return store;
    } catch {
      return localLoadCourtEngineStore(id, { tenantId });
    }
  }

  return {
    mode: "supabase-stub",
    table: TABLE,
    client,
    tenantId,
    buildStorageKey: (clubId) => buildCourtEngineStorageKey(clubId, tenantId),
    buildActiveKey: (clubId) => buildCourtEngineActiveKey(clubId, tenantId),
    loadCourtEngineStore(clubId) {
      return localLoadCourtEngineStore(clubId, { tenantId });
    },
    saveCourtEngineStore(clubId, store) {
      const result = localSaveCourtEngineStore(clubId, store, { tenantId });
      cache.set(`${tenantId}::${clubId}`, result.store);
      return { ...result, persisted: "local-cache-stub", cloudReady: false };
    },
    loadActiveSessionId(clubId) {
      return localLoadActiveSessionId(clubId, { tenantId });
    },
    saveActiveSessionId(clubId, sessionId) {
      return localSaveActiveSessionId(clubId, sessionId, { tenantId });
    },
    getSessionFromStore: localGetSessionFromStore,
    upsertSessionInStore: localUpsertSessionInStore,
    async syncToCloud(clubId) {
      const store = await hydrate(clubId);
      return { ok: false, error: "SupabaseCourtEngineStore stub — cloud write chưa bật.", store };
    },
    hydrate,
  };
}

