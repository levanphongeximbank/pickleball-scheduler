/**
 * Staging-only Supabase adapter implementing CustomerDatabaseClientPort.
 * Uses injectable supabase-js client. Never logs secrets. Not for Production UI.
 */

import { requireCustomerDatabaseClientPort } from "../persistence/databaseClientPort.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";

/**
 * @param {object} queryBuilder
 * @param {object} [filters]
 */
function applyFilters(queryBuilder, filters = {}) {
  let q = queryBuilder;
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined) continue;
    if (value === null) {
      q = q.is(key, null);
    } else if (Array.isArray(value)) {
      q = q.in(key, value);
    } else if (typeof value === "object" && value !== null && "ilike" in value) {
      q = q.ilike(key, value.ilike);
    } else if (typeof value === "object" && value !== null && "neq" in value) {
      q = q.neq(key, value.neq);
    } else {
      q = q.eq(key, value);
    }
  }
  return q;
}

/**
 * @param {{ client: object }} deps
 * @returns {import('../persistence/databaseClientPort.js').CustomerDatabaseClientPort}
 */
export function createSupabaseCustomerDatabaseClient(deps = {}) {
  const client = deps.client;
  if (!client || typeof client.from !== "function" || typeof client.rpc !== "function") {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
      "Supabase customer database client requires an injectable supabase-js client.",
      { adapter: "createSupabaseCustomerDatabaseClient" }
    );
  }

  const port = {
    async select({ table, columns = "*", filters = {}, order = [], limit } = {}) {
      let q = client.from(table).select(columns);
      q = applyFilters(q, filters);
      for (const entry of order || []) {
        q = q.order(entry.column, {
          ascending: entry.ascending !== false,
        });
      }
      if (limit != null) q = q.limit(limit);
      const { data, error } = await q;
      if (error) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.INVALID_INPUT,
          error.message || "Customer select failed.",
          { table, code: error.code }
        );
      }
      return data || [];
    },

    async insert({ table, rows, returning = true } = {}) {
      let q = client.from(table).insert(rows);
      if (returning) q = q.select("*");
      const { data, error } = await q;
      if (error) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.INVALID_INPUT,
          error.message || "Customer insert failed.",
          { table, code: error.code }
        );
      }
      return data || [];
    },

    async update({ table, values, filters = {}, returning = true } = {}) {
      let q = client.from(table).update(values);
      q = applyFilters(q, filters);
      if (returning) q = q.select("*");
      const { data, error } = await q;
      if (error) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.INVALID_INPUT,
          error.message || "Customer update failed.",
          { table, code: error.code }
        );
      }
      return data || [];
    },

    async delete({ table, filters = {} } = {}) {
      let q = client.from(table).delete();
      q = applyFilters(q, filters);
      const { data, error } = await q.select("*");
      if (error) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.INVALID_INPUT,
          error.message || "Customer delete failed.",
          { table, code: error.code }
        );
      }
      return Array.isArray(data) ? data.length : 0;
    },

    async rpc({ fn, args = {} } = {}) {
      const { data, error } = await client.rpc(fn, args);
      if (error) {
        const message = error.message || "Customer RPC failed.";
        if (/CUSTOMER_VERSION_CONFLICT|version conflict/i.test(message)) {
          throw new CustomerError(
            CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
            message,
            { fn, code: error.code }
          );
        }
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.INVALID_INPUT,
          message,
          { fn, code: error.code }
        );
      }
      return data;
    },
  };

  return requireCustomerDatabaseClientPort(port);
}
