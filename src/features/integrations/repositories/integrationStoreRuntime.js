import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import {
  INTEGRATION_STORE_MODES,
  resolveIntegrationStoreMode,
} from "./integrationRepository.js";
import { createLocalIntegrationStore } from "./localIntegrationStore.js";
import { createMemoryIntegrationStore } from "./memoryIntegrationStore.js";
import { createSupabaseIntegrationStore } from "./supabaseIntegrationStore.js";

let sharedStore = null;
const hydratePromises = new WeakMap();

export function isSupabaseIntegrationStore(store) {
  return store?.mode === INTEGRATION_STORE_MODES.SUPABASE;
}

export function createIntegrationStore({ mode, client, seed } = {}) {
  const resolvedMode = mode || resolveIntegrationStoreMode();

  switch (resolvedMode) {
    case INTEGRATION_STORE_MODES.MEMORY:
      return createMemoryIntegrationStore(seed);
    case INTEGRATION_STORE_MODES.SUPABASE: {
      const supabaseClient = client || getSupabaseAuthClient();
      if (!supabaseClient) {
        return createLocalIntegrationStore();
      }
      return createSupabaseIntegrationStore(supabaseClient, { cache: seed });
    }
    case INTEGRATION_STORE_MODES.LOCAL:
    default:
      return createLocalIntegrationStore();
  }
}

export function getIntegrationStore(options = {}) {
  if (!sharedStore || options.forceNew) {
    sharedStore = createIntegrationStore(options);
    if (isSupabaseIntegrationStore(sharedStore)) {
      void ensureIntegrationStoreHydrated(sharedStore);
    }
  }
  return sharedStore;
}

export function resetIntegrationStore() {
  sharedStore = null;
}

export async function ensureIntegrationStoreHydrated(store, { tenantId = null } = {}) {
  if (!isSupabaseIntegrationStore(store)) {
    return { ok: true, hydrated: false };
  }

  if (tenantId) {
    try {
      await store.hydrateTenant(tenantId);
      return { ok: true, hydrated: true, tenantId };
    } catch (error) {
      return {
        ok: false,
        hydrated: false,
        tenantId,
        error: error?.message || String(error),
      };
    }
  }

  if (store.__hydrated) {
    return { ok: true, hydrated: true };
  }

  if (!hydratePromises.has(store)) {
    hydratePromises.set(
      store,
      (async () => {
        try {
          await store.hydrateAll();
          store.__hydrated = true;
          return { ok: true, hydrated: true };
        } catch (error) {
          return {
            ok: false,
            hydrated: false,
            error: error?.message || String(error),
          };
        }
      })()
    );
  }

  return hydratePromises.get(store);
}

export async function persistIntegrationTenantSettings(store, tenantId, { updatedBy = null } = {}) {
  if (!isSupabaseIntegrationStore(store)) {
    return { ok: true, persisted: false };
  }

  try {
    const result = await store.persistTenant(tenantId, { updatedBy });
    return { ok: true, persisted: true, result };
  } catch (error) {
    return {
      ok: false,
      persisted: false,
      error: error?.message || String(error),
    };
  }
}
