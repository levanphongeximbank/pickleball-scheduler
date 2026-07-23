/**
 * Query construction helpers for Finance Supabase adapter (Phase 1G).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { IMMUTABLE_UPDATE_FIELDS } from "./rowMappers.js";

/**
 * @param {object} builder
 * @param {string} tenantId
 * @param {string} [id]
 */
export function applyTenantIdFilter(builder, tenantId, id) {
  let q = builder.eq("tenant_id", tenantId);
  if (id != null) q = q.eq("id", id);
  return q;
}

/**
 * Optimistic concurrency update filters: tenant + id + expected version.
 *
 * @param {object} builder
 * @param {string} tenantId
 * @param {string} id
 * @param {number} expectedVersion
 */
export function applyOptimisticUpdateFilters(builder, tenantId, id, expectedVersion) {
  return builder
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("version", expectedVersion);
}

/**
 * Strip immutable fields from an update patch.
 *
 * @param {Record<string, unknown>} rowPatch
 * @returns {Record<string, unknown>}
 */
export function stripImmutableUpdateFields(rowPatch) {
  /** @type {Record<string, unknown>} */
  const out = { ...rowPatch };
  for (const field of IMMUTABLE_UPDATE_FIELDS) {
    delete out[field];
  }
  return out;
}

/**
 * Map list sort contract to DB column + ascending flag.
 *
 * @param {string} sort
 * @returns {{ column: string, ascending: boolean }}
 */
export function resolveSort(sort) {
  switch (sort) {
    case "createdAtDesc":
      return { column: "created_at", ascending: false };
    case "occurredAtAsc":
      return { column: "occurred_at", ascending: true };
    case "occurredAtDesc":
      return { column: "occurred_at", ascending: false };
    case "createdAtAsc":
    default:
      return { column: "created_at", ascending: true };
  }
}

/**
 * @param {object} builder
 * @param {{ column: string, ascending: boolean }} sort
 * @param {number} limit
 */
export function applyOrderAndLimit(builder, sort, limit) {
  return builder.order(sort.column, { ascending: sort.ascending }).limit(limit);
}

/**
 * Ensure event list queries are bounded (tenant already required by createBoundedListQuery).
 *
 * @param {import('../repositories/durablePorts.js').createBoundedListQuery extends Function ? any : object} query
 */
export function assertEventListBounds(query) {
  if (query.limit == null || query.limit < 1) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Event list requires an explicit positive limit.",
      { field: "limit" }
    );
  }
  return query;
}
