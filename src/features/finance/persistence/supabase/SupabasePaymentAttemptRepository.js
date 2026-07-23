/**
 * Supabase Finance payment attempt repository (Phase 1G).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  normalizePaymentAttemptForWrite,
  paymentAttemptFromRow,
  paymentAttemptToRow,
} from "./rowMappers.js";
import { applyTenantIdFilter } from "./queryBuilders.js";
import {
  fetchByTenantId,
  insertRow,
  updateWithExpectedVersion,
  unwrapResult,
} from "./repositorySupport.js";

/**
 * @param {object} client
 */
export function createSupabasePaymentAttemptRepository(client) {
  const table = FINANCE_TABLES.paymentAttempts;
  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizePaymentAttemptForWrite(input, tid);
      const row = await insertRow(client, table, paymentAttemptToRow(record), "PaymentAttempt", tid);
      return paymentAttemptFromRow(row);
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "PaymentAttempt");
      return paymentAttemptFromRow(row);
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
          entity: "PaymentAttempt",
          tenantId: tid,
          table,
          operation: "findByProviderTransactionReference",
        }
      );
      return data ? paymentAttemptFromRow(data) : null;
    },
    async update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      const current = await this.getById(tid, id);
      const merged = normalizePaymentAttemptForWrite(
        {
          ...current,
          ...nextInput,
          id: current.id,
          tenantId: tid,
          paymentId: current.paymentId,
          version: current.version,
          createdAt: current.createdAt,
          providerTransactionReference:
            current.providerTransactionReference ?? nextInput?.providerTransactionReference,
        },
        tid
      );
      const patch = paymentAttemptToRow({ ...merged, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        id,
        expectedVersion,
        patch,
        "PaymentAttempt"
      );
      return paymentAttemptFromRow(row);
    },
    async listByPaymentId(tenantId, paymentId, queryInput = {}) {
      const tid = requireTenantScope(tenantId);
      const query = createBoundedListQuery({ ...queryInput, tenantId: tid, paymentId });
      const data = await unwrapResult(
        applyTenantIdFilter(client.from(table).select("*"), tid)
          .eq("payment_id", paymentId)
          .order("attempt_number", { ascending: true })
          .limit(query.limit),
        { entity: "PaymentAttempt", tenantId: tid, table, operation: "listByPaymentId" }
      );
      return Object.freeze((data || []).map(paymentAttemptFromRow));
    },
  });
}
