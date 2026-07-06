/**
 * Supabase court engine store — cloud read/write via courtEngineCloudStore.
 */
import {
  isCourtEngineCloudEnabled,
  migrateLocalCourtEngineToCloud,
  pullCourtEngineFromCloud,
  pushCourtEngineToCloud,
} from "./courtEngineCloudStore.js";
import {
  buildCourtEngineActiveKey,
  buildCourtEngineStorageKey,
  getSessionFromStore,
  loadActiveSessionId,
  loadCourtEngineStore,
  saveActiveSessionId,
  saveCourtEngineStore,
  upsertSessionInStore,
} from "./courtEngineStorage.js";

export function isSupabaseCourtEngineStoreEnabled() {
  return isCourtEngineCloudEnabled();
}

export function createSupabaseCourtEngineStore(client, { tenantId = "" } = {}) {
  const resolvedTenantId = String(tenantId || "").trim();

  return {
    mode: "supabase",
    client,
    tenantId: resolvedTenantId,
    buildStorageKey: (clubId) => buildCourtEngineStorageKey(clubId, resolvedTenantId),
    buildActiveKey: (clubId) => buildCourtEngineActiveKey(clubId, resolvedTenantId),
    loadCourtEngineStore(clubId) {
      return loadCourtEngineStore(clubId, { tenantId: resolvedTenantId });
    },
    saveCourtEngineStore(clubId, store) {
      return saveCourtEngineStore(clubId, store, { tenantId: resolvedTenantId });
    },
    loadActiveSessionId(clubId) {
      return loadActiveSessionId(clubId, { tenantId: resolvedTenantId });
    },
    saveActiveSessionId(clubId, sessionId) {
      return saveActiveSessionId(clubId, sessionId, { tenantId: resolvedTenantId });
    },
    getSessionFromStore,
    upsertSessionInStore,
    async hydrate(clubId) {
      return pullCourtEngineFromCloud(clubId, resolvedTenantId, client);
    },
    async syncToCloud(clubId) {
      const store = loadCourtEngineStore(clubId, { tenantId: resolvedTenantId });
      return pushCourtEngineToCloud(clubId, resolvedTenantId, {
        client,
        expectedVersion: store.cloudVersion ?? 0,
      });
    },
    async migrateLocal(clubId) {
      return migrateLocalCourtEngineToCloud(clubId, resolvedTenantId, client);
    },
  };
}
