import { deserializeBillingRow, serializeBillingRow } from "./billingRowMap.js";
import { BILLING_HYDRATE_COLLECTIONS } from "./billingStoreRuntime.js";
import { getBillingTableName } from "./collectionMap.js";

/**
 * Supabase-backed billing store with in-memory cache.
 * Services keep the sync read/write contract; hydrate/persist are async.
 */
export function createSupabaseBillingStore(client, { cache = {} } = {}) {
  if (!client) {
    throw new Error("Supabase client required for supabase billing store");
  }

  const state = {
    plans: [],
    planLimits: [],
    subscriptions: [],
    invoices: [],
    invoiceItems: [],
    payments: [],
    billingEvents: [],
    billingAuditLogs: [],
    ...cache,
  };

  const dirty = new Set();

  return {
    mode: "supabase",
    client,
    read(collection) {
      return state[collection] ? [...state[collection]] : [];
    },
    write(collection, value) {
      state[collection] = Array.isArray(value) ? [...value] : value;
      dirty.add(collection);
      return state[collection];
    },
    markDirty(collection) {
      dirty.add(collection);
    },
    clearDirty(collection) {
      if (collection) {
        dirty.delete(collection);
        return;
      }
      dirty.clear();
    },
    getDirtyCollections() {
      return [...dirty];
    },
    async hydrate(collection) {
      const table = getBillingTableName(collection);
      const { data, error } = await client.from(table).select("*");
      if (error) {
        throw error;
      }
      state[collection] = (data || []).map((row) => deserializeBillingRow(collection, row));
      return state[collection];
    },
    async hydrateAll() {
      const results = {};
      for (const collection of BILLING_HYDRATE_COLLECTIONS) {
        results[collection] = await this.hydrate(collection);
      }
      return results;
    },
    async persistCollection(collection) {
      const table = getBillingTableName(collection);
      const rows = (state[collection] || []).map((row) => serializeBillingRow(collection, row));
      if (!rows.length) {
        return { table, upserted: 0 };
      }
      const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
      if (error) {
        throw error;
      }
      dirty.delete(collection);
      return { table, upserted: rows.length };
    },
    async flushDirty(collections) {
      const targets = collections?.length ? [...new Set(collections)] : [...dirty];
      const persisted = [];
      const errors = [];

      for (const collection of targets) {
        try {
          const result = await this.persistCollection(collection);
          persisted.push(result);
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
    },
  };
}
