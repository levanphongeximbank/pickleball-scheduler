/**
 * Injectable Supabase CRM database client adapter (Phase 1H-A).
 *
 * Implements CrmDatabaseClientPort behind an injected Supabase-like client.
 * - No global client construction
 * - No credential reads at module import
 * - No Production configuration imports
 * - Explicit table / operation / RPC allowlists
 * - TenantVenueScope validated before every scoped table operation
 * - Fakes only in tests — no live Supabase connection here
 */

import { CRM_ERROR_CODES, CrmError } from "../../constants/errorCodes.js";
import { createTenantVenueScope } from "../../models/scope.js";
import {
  CRM_PHASE_1G_RPC,
  CRM_PHASE_1G_TABLES,
  requireCrmDatabaseClientPort,
} from "../databaseClientPort.js";

/** @type {ReadonlySet<string>} */
export const CRM_SUPABASE_TABLE_ALLOWLIST = Object.freeze(
  new Set(Object.values(CRM_PHASE_1G_TABLES))
);

/** @type {ReadonlySet<string>} */
export const CRM_SUPABASE_RPC_ALLOWLIST = Object.freeze(
  new Set(Object.values(CRM_PHASE_1G_RPC))
);

/**
 * Per-table allowed operations for Phase 1G resources.
 * @type {Readonly<Record<string, ReadonlySet<string>>>}
 */
export const CRM_SUPABASE_OPERATION_ALLOWLIST = Object.freeze({
  [CRM_PHASE_1G_TABLES.TAGS]: Object.freeze(new Set(["select", "insert", "update"])),
  [CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS]: Object.freeze(
    new Set(["select", "insert", "delete"])
  ),
  [CRM_PHASE_1G_TABLES.CONSENT_RECORDS]: Object.freeze(
    new Set(["select", "insert"])
  ),
  [CRM_PHASE_1G_TABLES.PENDING_EVENTS]: Object.freeze(
    new Set(["select", "insert", "update"])
  ),
});

const SCOPE_FILTER_KEYS = Object.freeze(["tenant_id", "venue_id"]);

/**
 * @param {unknown} client
 * @returns {asserts client is { from: Function, rpc: Function }}
 */
function requireInjectedSupabaseLikeClient(client) {
  if (!client || typeof client !== "object") {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "createSupabaseCrmDatabaseClient requires an injected Supabase-like client."
    );
  }
  if (typeof client.from !== "function" || typeof client.rpc !== "function") {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "Injected client must expose from() and rpc()."
    );
  }
}

/**
 * @param {string} table
 * @param {string} operation
 */
function assertTableOperationAllowed(table, operation) {
  if (!CRM_SUPABASE_TABLE_ALLOWLIST.has(table)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `CRM Supabase adapter rejects unknown table: ${table}`
    );
  }
  const allowed = CRM_SUPABASE_OPERATION_ALLOWLIST[table];
  if (!allowed || !allowed.has(operation)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `CRM Supabase adapter rejects ${operation} on ${table}`
    );
  }
}

/**
 * Validate TenantVenueScope and require matching tenant_id / venue_id filters.
 * @param {object} filters
 * @returns {{ tenantId: string, venueId: string }}
 */
function requireScopedFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "CRM table operations require scoped filters including tenant_id and venue_id."
    );
  }
  const tenantId = filters.tenant_id;
  const venueId = filters.venue_id;
  if (tenantId == null || venueId == null) {
    throw new CrmError(
      CRM_ERROR_CODES.MISSING_SCOPE,
      "CRM table operations require tenant_id and venue_id filters."
    );
  }
  return createTenantVenueScope({ tenantId, venueId });
}

/**
 * Validate insert rows carry matching scope columns.
 * @param {object|object[]} rows
 * @returns {object[]}
 */
function requireScopedRows(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  if (list.length === 0) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "CRM insert requires at least one row."
    );
  }
  for (const row of list) {
    if (!row || typeof row !== "object") {
      throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "CRM insert row invalid.");
    }
    createTenantVenueScope({
      tenantId: row.tenant_id,
      venueId: row.venue_id,
    });
  }
  return list;
}

/**
 * Apply equality filters to a Supabase query builder.
 * Supports plain equality and `{ in: [...] }` for limited IN filters.
 * @param {any} query
 * @param {object} filters
 */
function applyFilters(query, filters) {
  let q = query;
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.in)) {
      q = q.in(key, value.in);
      continue;
    }
    q = q.eq(key, value);
  }
  return q;
}

/**
 * Normalize Supabase-like result payloads into arrays / counts.
 * Preserves error objects with code/message for CRM error translation.
 * @param {{ data?: unknown, error?: { code?: string, message?: string, details?: unknown }|null, count?: number|null }} result
 * @param {"rows"|"count"|"rpc"} mode
 */
function normalizeResult(result, mode) {
  if (result && result.error) {
    const err = new Error(String(result.error.message || "Supabase CRM adapter error"));
    err.code = result.error.code;
    err.details = result.error.details;
    err.name = "CrmSupabaseAdapterError";
    throw err;
  }

  if (mode === "count") {
    if (typeof result?.count === "number") return result.count;
    if (Array.isArray(result?.data)) return result.data.length;
    return 0;
  }

  if (mode === "rpc") {
    return result?.data;
  }

  const data = result?.data;
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

/**
 * Create a CrmDatabaseClientPort backed by an injected Supabase-like client.
 *
 * @param {{
 *   client: { from: Function, rpc: Function },
 * }} deps
 * @returns {import('../databaseClientPort.js').CrmDatabaseClientPort}
 */
export function createSupabaseCrmDatabaseClient(deps = {}) {
  requireInjectedSupabaseLikeClient(deps.client);
  const client = deps.client;

  const port = {
    async select(request = {}) {
      const table = String(request.table || "");
      assertTableOperationAllowed(table, "select");
      requireScopedFilters(request.filters || {});

      const columns =
        request.columns == null || request.columns === "*"
          ? "*"
          : String(request.columns);
      // Wildcard selection is allowed only after table allowlist + scope filters.
      // Prefer explicit column lists at call sites when available.

      let query = client.from(table).select(columns);
      query = applyFilters(query, request.filters);

      if (Array.isArray(request.order)) {
        for (const ord of request.order) {
          if (!ord || !ord.column) continue;
          query = query.order(String(ord.column), {
            ascending: ord.ascending !== false,
          });
        }
      }

      if (request.limit != null) {
        const limit = Number(request.limit);
        if (!Number.isInteger(limit) || limit < 1) {
          throw new CrmError(
            CRM_ERROR_CODES.INVALID_INPUT,
            "select limit must be a positive integer."
          );
        }
        query = query.limit(limit);
      }

      const result = await query;
      return normalizeResult(result, "rows");
    },

    async insert(request = {}) {
      const table = String(request.table || "");
      assertTableOperationAllowed(table, "insert");
      const rows = requireScopedRows(request.rows);

      let query = client.from(table).insert(rows);
      if (request.returning !== false) {
        query = query.select();
      }

      const result = await query;
      if (request.returning === false) {
        if (result?.error) normalizeResult(result, "rows");
        return [];
      }
      return normalizeResult(result, "rows");
    },

    async update(request = {}) {
      const table = String(request.table || "");
      assertTableOperationAllowed(table, "update");
      requireScopedFilters(request.filters || {});

      if (!request.values || typeof request.values !== "object") {
        throw new CrmError(
          CRM_ERROR_CODES.INVALID_INPUT,
          "update requires values object."
        );
      }

      // Never allow scope reassignment via values without matching filters.
      if (
        request.values.tenant_id != null &&
        String(request.values.tenant_id) !== String(request.filters.tenant_id)
      ) {
        throw new CrmError(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "CRM update cannot change tenant_id."
        );
      }
      if (
        request.values.venue_id != null &&
        String(request.values.venue_id) !== String(request.filters.venue_id)
      ) {
        throw new CrmError(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "CRM update cannot change venue_id."
        );
      }

      let query = client.from(table).update(request.values);
      query = applyFilters(query, request.filters);
      if (request.returning !== false) {
        query = query.select();
      }

      const result = await query;
      if (request.returning === false) {
        if (result?.error) normalizeResult(result, "rows");
        return [];
      }
      return normalizeResult(result, "rows");
    },

    async delete(request = {}) {
      const table = String(request.table || "");
      // Only tag assignments may delete — allowlist enforces this.
      assertTableOperationAllowed(table, "delete");
      requireScopedFilters(request.filters || {});

      let query = client.from(table).delete({ count: "exact" });
      query = applyFilters(query, request.filters);
      const result = await query;
      return normalizeResult(result, "count");
    },

    async rpc(request = {}) {
      const fn = String(request.fn || "");
      if (!CRM_SUPABASE_RPC_ALLOWLIST.has(fn)) {
        throw new CrmError(
          CRM_ERROR_CODES.INVALID_INPUT,
          `CRM Supabase adapter rejects unknown RPC: ${fn}`
        );
      }
      const args = request.args && typeof request.args === "object" ? request.args : {};

      // Scope parameters required for both claim and release RPCs.
      createTenantVenueScope({
        tenantId: args.p_tenant_id,
        venueId: args.p_venue_id,
      });

      const result = await client.rpc(fn, args);
      return normalizeResult(result, "rpc");
    },
  };

  // Freeze via port validator (binds methods; does not expose client).
  return requireCrmDatabaseClientPort(port);
}

export { SCOPE_FILTER_KEYS };
