/**
 * Supabase Finance fee definition repository (Phase 1G).
 */

import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  feeDefinitionFromRow,
  feeDefinitionToRow,
  normalizeFeeDefinitionRecord,
} from "./rowMappers.js";
import {
  applyOrderAndLimit,
  applyTenantIdFilter,
  resolveSort,
} from "./queryBuilders.js";
import {
  fetchByTenantId,
  insertRow,
  updateWithExpectedVersion,
  unwrapResult,
} from "./repositorySupport.js";

/**
 * @param {object} client
 */
export function createSupabaseFeeDefinitionRepository(client) {
  const table = FINANCE_TABLES.feeDefinitions;
  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizeFeeDefinitionRecord(input, tid);
      const row = await insertRow(client, table, feeDefinitionToRow(record), "FeeDefinition", tid);
      return feeDefinitionFromRow(row);
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "FeeDefinition");
      return feeDefinitionFromRow(row);
    },
    async findByBusinessReference() {
      return null;
    },
    async update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      const current = await this.getById(tid, id);
      const merged = normalizeFeeDefinitionRecord(
        {
          ...current,
          ...nextInput,
          id: current.id,
          tenantId: tid,
          version: current.version,
          createdAt: current.createdAt,
        },
        tid
      );
      const patch = feeDefinitionToRow({ ...merged, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        id,
        expectedVersion,
        patch,
        "FeeDefinition"
      );
      return feeDefinitionFromRow(row);
    },
    async list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      let builder = applyTenantIdFilter(client.from(table).select("*"), query.tenantId);
      if (query.status) builder = builder.eq("status", query.status);
      const sort = resolveSort(query.sort);
      const data = await unwrapResult(
        applyOrderAndLimit(builder, sort, query.limit),
        { entity: "FeeDefinition", tenantId: query.tenantId, table, operation: "list" }
      );
      return Object.freeze((data || []).map(feeDefinitionFromRow));
    },
  });
}
