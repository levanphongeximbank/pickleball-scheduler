/**
 * Shared execute helpers for Finance Supabase repositories (Phase 1G).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  notFoundError,
  requireExpectedVersion,
  requireTenantScope,
  versionConflictError,
} from "../repositories/durablePorts.js";
import { mapSupabaseFinanceError } from "./errorMapping.js";
import {
  applyOptimisticUpdateFilters,
  applyTenantIdFilter,
  stripImmutableUpdateFields,
} from "./queryBuilders.js";

/**
 * @param {Promise<{ data: any, error: any }>| { data: any, error: any }} result
 */
export async function unwrapResult(result, context = {}) {
  const resolved = await result;
  if (resolved?.error) {
    throw mapSupabaseFinanceError(resolved.error, context);
  }
  return resolved?.data;
}

/**
 * @param {object} client
 * @param {string} table
 * @param {string} tenantId
 * @param {string} id
 * @param {string} entity
 */
export async function fetchByTenantId(client, table, tenantId, id, entity) {
  const tid = requireTenantScope(tenantId);
  const data = await unwrapResult(
    applyTenantIdFilter(client.from(table).select("*"), tid, id).maybeSingle(),
    { entity, tenantId: tid, id, table, operation: "getById" }
  );
  if (!data) throw notFoundError(entity, tid, id);
  if (data.tenant_id !== tid) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH,
      "Cross-tenant row rejected.",
      { entity, tenantId: tid, id }
    );
  }
  return data;
}

/**
 * @param {object} client
 * @param {string} table
 * @param {string} tenantId
 * @param {string} id
 * @param {string} entity
 */
export async function findByTenantId(client, table, tenantId, id, entity) {
  const tid = requireTenantScope(tenantId);
  const data = await unwrapResult(
    applyTenantIdFilter(client.from(table).select("*"), tid, id).maybeSingle(),
    { entity, tenantId: tid, id, table, operation: "findById" }
  );
  if (!data) return null;
  if (data.tenant_id !== tid) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH,
      "Cross-tenant row rejected.",
      { entity, tenantId: tid, id }
    );
  }
  return data;
}

/**
 * @param {object} client
 * @param {string} table
 * @param {object} row
 * @param {string} entity
 * @param {string} tenantId
 */
export async function insertRow(client, table, row, entity, tenantId) {
  if (row.tenant_id !== tenantId) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH,
      "Insert tenant_id must match operation tenantId.",
      { entity, tenantId }
    );
  }
  const data = await unwrapResult(
    client.from(table).insert(row).select("*").single(),
    { entity, tenantId, id: row.id, table, operation: "create" }
  );
  if (!data) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_UNKNOWN_FAILURE,
      `${entity} create returned no row.`,
      { entity, tenantId, table }
    );
  }
  return data;
}

/**
 * Optimistic concurrency update. No matching row → version conflict (or not found if missing entirely).
 *
 * @param {object} client
 * @param {string} table
 * @param {string} tenantId
 * @param {string} id
 * @param {number} expectedVersion
 * @param {object} rowPatch
 * @param {string} entity
 */
export async function updateWithExpectedVersion(
  client,
  table,
  tenantId,
  id,
  expectedVersion,
  rowPatch,
  entity
) {
  const tid = requireTenantScope(tenantId);
  requireExpectedVersion(expectedVersion);
  const nextVersion = expectedVersion + 1;
  const patch = stripImmutableUpdateFields({
    ...rowPatch,
    version: nextVersion,
  });

  const data = await unwrapResult(
    applyOptimisticUpdateFilters(client.from(table).update(patch), tid, id, expectedVersion)
      .select("*")
      .maybeSingle(),
    { entity, tenantId: tid, id, table, operation: "update" }
  );

  if (!data) {
    // Distinguish missing vs stale version
    const existing = await findByTenantId(client, table, tid, id, entity);
    if (!existing) throw notFoundError(entity, tid, id);
    throw versionConflictError(entity, {
      tenantId: tid,
      id,
      expectedVersion,
      actualVersion: existing.version,
    });
  }

  if (data.tenant_id !== tid) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH,
      "Cross-tenant update result rejected.",
      { entity, tenantId: tid, id }
    );
  }
  if (data.version !== nextVersion) {
    throw versionConflictError(entity, {
      tenantId: tid,
      id,
      expectedVersion,
      actualVersion: data.version,
    });
  }
  return data;
}
