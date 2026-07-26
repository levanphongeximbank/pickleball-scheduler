/**
 * Supabase court engine store — durable adapter wrapper (no localStorage working set).
 */

import { isCourtEngineCloudEnabled } from "./courtEngineCloudStore.js";
import { createDurableCourtRuntimeAdapter } from "../runtime/adapters/createDurableCourtRuntimeAdapter.js";
import {
  getSessionFromStore,
  upsertSessionInStore,
} from "../runtime/createCourtRuntimeWriter.js";
import { COURT_RUNTIME_AUTHORITY } from "../runtime/constants.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "../runtime/errors.js";

export function isSupabaseCourtEngineStoreEnabled() {
  return isCourtEngineCloudEnabled();
}

/**
 * @param {object|null} client
 * @param {{ tenantId?: string, writer?: object, adapter?: object }} [options]
 */
export function createSupabaseCourtEngineStore(client, options = {}) {
  const resolvedTenantId = String(options.tenantId || "").trim();
  const adapter =
    options.adapter ||
    options.writer?.adapter ||
    createDurableCourtRuntimeAdapter({ client });

  return {
    mode: "supabase",
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    client,
    tenantId: resolvedTenantId,
    dualWrite: false,
    usesLocalStorage: false,
    adapter,
    loadCourtEngineStore(clubId) {
      const loaded = adapter.loadRuntime(resolvedTenantId, clubId);
      return loaded.ok
        ? loaded.store
        : { clubId, tenantId: resolvedTenantId, sessions: [] };
    },
    saveCourtEngineStore() {
      return createCourtRuntimeError(
        COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_UNSUPPORTED_DURABLE_COMMAND,
        "Use saveCourtEngineStoreAsync for durable Court runtime writes."
      );
    },
    async saveCourtEngineStoreAsync(clubId, store) {
      if (!resolvedTenantId) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
          "tenantId is required for durable Court runtime writes."
        );
      }
      return adapter.saveRuntime(resolvedTenantId, clubId, store);
    },
    loadActiveSessionId(clubId) {
      return adapter.loadActiveSessionId(resolvedTenantId, clubId);
    },
    saveActiveSessionId() {
      return createCourtRuntimeError(
        COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_UNSUPPORTED_DURABLE_COMMAND,
        "Use saveActiveSessionIdAsync for durable active session writes."
      );
    },
    async saveActiveSessionIdAsync(clubId, sessionId) {
      if (!resolvedTenantId) {
        return createCourtRuntimeError(
          COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
          "tenantId is required for durable active session writes."
        );
      }
      return adapter.setActiveSessionId(resolvedTenantId, clubId, sessionId);
    },
    getSessionFromStore,
    upsertSessionInStore,
    async hydrate(clubId) {
      return adapter.hydrateRuntime(resolvedTenantId, clubId);
    },
    async syncToCloud(clubId) {
      const loaded = adapter.loadRuntime(resolvedTenantId, clubId);
      if (!loaded.ok) {
        return loaded;
      }
      return adapter.saveRuntime(resolvedTenantId, clubId, loaded.store, {
        expectedVersion: loaded.store.cloudVersion ?? 0,
      });
    },
  };
}
