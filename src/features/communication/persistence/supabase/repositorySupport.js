/**
 * Shared Supabase query helpers for Communication adapters (COMMS-05).
 */

import { mapSupabaseCommunicationError } from "./errorMapping.js";
import { assertCommunicationTableName } from "./clientContract.js";

/**
 * @param {Promise<{ data: unknown, error: unknown }>|{ data: unknown, error: unknown }} resultLike
 * @param {object} [context]
 */
export async function unwrapResult(resultLike, context = {}) {
  const result = await resultLike;
  if (result?.error) {
    throw mapSupabaseCommunicationError(result.error, context);
  }
  return result?.data ?? null;
}

/**
 * @param {object} client
 * @param {string} table
 * @param {object} row
 * @param {string} entity
 * @param {object} [context]
 */
export async function insertRow(client, table, row, entity, context = {}) {
  assertCommunicationTableName(table);
  const data = await unwrapResult(
    client.from(table).insert(row).select("*").maybeSingle(),
    { entity, table, operation: "insert", ...context }
  );
  return data;
}

/**
 * @param {object} client
 * @param {string} table
 * @param {object} row
 * @param {string} entity
 * @param {object} [context]
 */
export async function upsertRow(client, table, row, entity, context = {}) {
  assertCommunicationTableName(table);
  const data = await unwrapResult(
    client.from(table).upsert(row).select("*").maybeSingle(),
    { entity, table, operation: "upsert", ...context }
  );
  return data;
}

/**
 * @param {object} client
 * @param {string} table
 * @param {string} idColumn
 * @param {string} id
 * @param {string} entity
 * @param {object} [context]
 */
export async function fetchById(client, table, idColumn, id, entity, context = {}) {
  assertCommunicationTableName(table);
  return unwrapResult(
    client.from(table).select("*").eq(idColumn, id).maybeSingle(),
    { entity, table, operation: "findById", ...context }
  );
}

/**
 * @param {object} client
 * @param {string} fnName
 * @param {object} args
 * @param {object} [context]
 */
export async function callRpc(client, fnName, args, context = {}) {
  if (typeof client.rpc !== "function") {
    throw mapSupabaseCommunicationError(
      {
        message: "Injected client does not support rpc()",
        code: "PERSISTENCE_CAPABILITY_UNSUPPORTED",
      },
      { ...context, operation: fnName }
    );
  }
  return unwrapResult(client.rpc(fnName, args), {
    ...context,
    operation: fnName,
  });
}

/**
 * Pagination by immutable position (preferred over offset).
 * @param {object} query
 * @param {{ afterPosition?: number|null, beforePosition?: number|null, limit?: number, ascending?: boolean }} [cursor]
 */
export function applyPositionPagination(query, cursor = {}) {
  let q = query;
  if (cursor.afterPosition != null) {
    q = q.gt("position", cursor.afterPosition);
  }
  if (cursor.beforePosition != null) {
    q = q.lt("position", cursor.beforePosition);
  }
  const ascending = cursor.ascending !== false;
  q = q.order("position", { ascending });
  if (cursor.limit != null) {
    q = q.limit(cursor.limit);
  }
  return q;
}
