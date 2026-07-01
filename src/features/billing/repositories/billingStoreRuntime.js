import { BILLING_STORE_MODES } from "./billingRepository.js";

const hydratePromises = new WeakMap();

export const BILLING_PERSIST_SETS = Object.freeze({
  SUBSCRIPTION: ["subscriptions", "billingAuditLogs", "billingEvents"],
  INVOICE: ["invoices", "invoiceItems", "billingAuditLogs"],
  PAYMENT: ["payments", "invoices", "subscriptions", "billingAuditLogs", "billingEvents"],
  PLAN_CHANGE: ["subscriptions", "billingAuditLogs", "billingEvents"],
  AUDIT_ONLY: ["billingAuditLogs", "billingEvents"],
});

export const BILLING_HYDRATE_COLLECTIONS = Object.freeze([
  "plans",
  "planLimits",
  "subscriptions",
  "invoices",
  "invoiceItems",
  "payments",
  "billingEvents",
  "billingAuditLogs",
]);

export function isSupabaseBillingStore(store) {
  return store?.mode === BILLING_STORE_MODES.SUPABASE;
}

export function shouldSeedBillingDefaults(store) {
  return !isSupabaseBillingStore(store);
}

/**
 * Hydrate all billing collections from Supabase once per store instance.
 * Safe to call multiple times — returns the same in-flight promise.
 */
export async function ensureBillingStoreHydrated(store) {
  if (!isSupabaseBillingStore(store)) {
    return { ok: true, hydrated: false };
  }

  if (store.__hydrated) {
    return { ok: true, hydrated: true };
  }

  if (!hydratePromises.has(store)) {
    hydratePromises.set(
      store,
      (async () => {
        try {
          if (typeof store.hydrateAll === "function") {
            await store.hydrateAll();
          }
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

/** Reset hydrate cache (tests). */
export function resetBillingStoreHydration(store) {
  if (store) {
    store.__hydrated = false;
    hydratePromises.delete(store);
    store.clearDirty?.();
  }
}

/**
 * Persist billing collections to Supabase. Never throws — returns error details.
 */
export async function persistBillingCollections(store, collections = []) {
  if (!isSupabaseBillingStore(store) || !collections.length) {
    return { ok: true, persisted: [], errors: [] };
  }

  const unique = [...new Set(collections)];
  const persisted = [];
  const errors = [];

  for (const collection of unique) {
    try {
      if (typeof store.persistCollection !== "function") {
        break;
      }
      const result = await store.persistCollection(collection);
      persisted.push(result);
      store.clearDirty?.(collection);
    } catch (error) {
      errors.push({
        collection,
        message: error?.message || String(error),
      });
    }
  }

  return {
    ok: errors.length === 0,
    persisted,
    errors,
  };
}

/** Flush dirty collections tracked on the store, or explicit list. */
export async function flushBillingStoreDirty(store, collections) {
  if (!isSupabaseBillingStore(store)) {
    return { ok: true, persisted: [], errors: [] };
  }

  if (typeof store.flushDirty === "function") {
    try {
      return await store.flushDirty(collections);
    } catch (error) {
      return {
        ok: false,
        persisted: [],
        errors: [{ collection: "*", message: error?.message || String(error) }],
      };
    }
  }

  const targets =
    collections?.length > 0 ? collections : typeof store.getDirtyCollections === "function" ? store.getDirtyCollections() : [];

  return persistBillingCollections(store, targets);
}
