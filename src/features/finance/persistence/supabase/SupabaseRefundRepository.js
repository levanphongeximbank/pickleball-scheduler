/**
 * Supabase Finance refund repository (Phase 1G).
 */

import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  normalizeRefundForWrite,
  refundFromRow,
  refundToRow,
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
export function createSupabaseRefundRepository(client) {
  const table = FINANCE_TABLES.refunds;
  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizeRefundForWrite(input, tid);
      const row = await insertRow(client, table, refundToRow(record), "Refund", tid);
      return refundFromRow(row);
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "Refund");
      return refundFromRow(row);
    },
    async findByBusinessReference() {
      return null;
    },
    async update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      const current = await this.getById(tid, id);
      const merged = normalizeRefundForWrite(
        {
          ...current,
          ...nextInput,
          id: current.id,
          tenantId: tid,
          paymentId: current.paymentId,
          version: current.version,
          createdAt: current.createdAt,
        },
        tid
      );
      const patch = refundToRow({ ...merged, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        id,
        expectedVersion,
        patch,
        "Refund"
      );
      return refundFromRow(row);
    },
    async list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      let builder = applyTenantIdFilter(client.from(table).select("*"), query.tenantId);
      if (query.status) builder = builder.eq("status", query.status);
      if (query.paymentId) builder = builder.eq("payment_id", query.paymentId);
      const data = await unwrapResult(
        applyOrderAndLimit(builder, resolveSort(query.sort), query.limit),
        { entity: "Refund", tenantId: query.tenantId, table, operation: "list" }
      );
      return Object.freeze((data || []).map(refundFromRow));
    },
  });
}
