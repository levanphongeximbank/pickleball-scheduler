/**
 * Supabase Finance receipt repository (Phase 1G) — create/get/list only (immutable).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  normalizeReceiptForWrite,
  receiptFromRow,
  receiptToRow,
} from "./rowMappers.js";
import {
  applyOrderAndLimit,
  applyTenantIdFilter,
  resolveSort,
} from "./queryBuilders.js";
import { fetchByTenantId, insertRow, unwrapResult } from "./repositorySupport.js";

/**
 * @param {object} client
 */
export function createSupabaseReceiptRepository(client) {
  const table = FINANCE_TABLES.receipts;
  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizeReceiptForWrite(input, tid);
      const row = await insertRow(client, table, receiptToRow(record), "Receipt", tid);
      return receiptFromRow(row);
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "Receipt");
      return receiptFromRow(row);
    },
    async findByPaymentId(tenantId, paymentId) {
      const tid = requireTenantScope(tenantId);
      const data = await unwrapResult(
        applyTenantIdFilter(client.from(table).select("*"), tid)
          .eq("payment_id", paymentId)
          .maybeSingle(),
        { entity: "Receipt", tenantId: tid, table, operation: "findByPaymentId" }
      );
      return data ? receiptFromRow(data) : null;
    },
    async list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      let builder = applyTenantIdFilter(client.from(table).select("*"), query.tenantId);
      if (query.paymentId) builder = builder.eq("payment_id", query.paymentId);
      const data = await unwrapResult(
        applyOrderAndLimit(builder, resolveSort(query.sort), query.limit),
        { entity: "Receipt", tenantId: query.tenantId, table, operation: "list" }
      );
      return Object.freeze((data || []).map(receiptFromRow));
    },
    async update() {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Receipt records are immutable after create.",
        { entity: "Receipt" }
      );
    },
    async delete() {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Receipt records cannot be deleted through the Finance adapter.",
        { entity: "Receipt" }
      );
    },
  });
}
