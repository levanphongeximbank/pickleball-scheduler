/**
 * Supabase Finance obligation repository (Phase 1G).
 */

import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  normalizeObligationForWrite,
  obligationFromRow,
  obligationToRow,
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
export function createSupabaseObligationRepository(client) {
  const table = FINANCE_TABLES.obligations;
  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizeObligationForWrite(input, tid);
      const row = await insertRow(client, table, obligationToRow(record), "FinancialObligation", tid);
      return obligationFromRow(row);
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "FinancialObligation");
      return obligationFromRow(row);
    },
    async findByBusinessReference(tenantId, businessReference) {
      const tid = requireTenantScope(tenantId);
      const data = await unwrapResult(
        applyTenantIdFilter(client.from(table).select("*"), tid)
          .eq("business_reference", businessReference)
          .maybeSingle(),
        { entity: "FinancialObligation", tenantId: tid, table, operation: "findByBusinessReference" }
      );
      return data ? obligationFromRow(data) : null;
    },
    async update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      const current = await this.getById(tid, id);
      const merged = normalizeObligationForWrite(
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
      const patch = obligationToRow({ ...merged, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        id,
        expectedVersion,
        patch,
        "FinancialObligation"
      );
      return obligationFromRow(row);
    },
    async list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      let builder = applyTenantIdFilter(client.from(table).select("*"), query.tenantId);
      if (query.status) builder = builder.eq("status", query.status);
      if (query.businessReference) {
        builder = builder.eq("business_reference", query.businessReference);
      }
      const data = await unwrapResult(
        applyOrderAndLimit(builder, resolveSort(query.sort), query.limit),
        { entity: "FinancialObligation", tenantId: query.tenantId, table, operation: "list" }
      );
      return Object.freeze((data || []).map(obligationFromRow));
    },
  });
}
