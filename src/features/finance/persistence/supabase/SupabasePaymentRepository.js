/**
 * Supabase Finance payment repository (Phase 1G).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  normalizePaymentForWrite,
  paymentFromRow,
  paymentToRow,
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
export function createSupabasePaymentRepository(client) {
  const table = FINANCE_TABLES.payments;
  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizePaymentForWrite(input, tid);
      const row = await insertRow(client, table, paymentToRow(record), "Payment", tid);
      return paymentFromRow(row);
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "Payment");
      return paymentFromRow(row);
    },
    async findByProviderTransactionReference(tenantId, providerCode, providerTransactionReference) {
      const tid = requireTenantScope(tenantId);
      if (providerTransactionReference == null || providerTransactionReference === "") {
        throw new FinanceError(
          FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
          "providerTransactionReference is required.",
          { field: "providerTransactionReference" }
        );
      }
      const data = await unwrapResult(
        applyTenantIdFilter(client.from(table).select("*"), tid)
          .eq("provider_code", providerCode ?? null)
          .eq("provider_transaction_reference", providerTransactionReference)
          .maybeSingle(),
        {
          entity: "Payment",
          tenantId: tid,
          table,
          operation: "findByProviderTransactionReference",
          providerCode: providerCode || undefined,
        }
      );
      return data ? paymentFromRow(data) : null;
    },
    async update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      const current = await this.getById(tid, id);
      const merged = normalizePaymentForWrite(
        {
          ...current,
          ...nextInput,
          id: current.id,
          tenantId: tid,
          version: current.version,
          createdAt: current.createdAt,
          // Preserve immutable provider reference once set
          providerTransactionReference:
            current.providerTransactionReference ?? nextInput?.providerTransactionReference,
          providerCode: current.providerCode ?? nextInput?.providerCode,
        },
        tid
      );
      const patch = paymentToRow({ ...merged, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        id,
        expectedVersion,
        patch,
        "Payment"
      );
      return paymentFromRow(row);
    },
    async list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      let builder = applyTenantIdFilter(client.from(table).select("*"), query.tenantId);
      if (query.status) builder = builder.eq("status", query.status);
      const data = await unwrapResult(
        applyOrderAndLimit(builder, resolveSort(query.sort), query.limit),
        { entity: "Payment", tenantId: query.tenantId, table, operation: "list" }
      );
      return Object.freeze((data || []).map(paymentFromRow));
    },
  });
}
