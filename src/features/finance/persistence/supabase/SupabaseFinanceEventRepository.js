/**
 * Supabase Finance event repository — append-only (Phase 1G).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import { eventFromRow, eventToRow, normalizeEventForWrite } from "./rowMappers.js";
import {
  applyOrderAndLimit,
  applyTenantIdFilter,
  assertEventListBounds,
  resolveSort,
} from "./queryBuilders.js";
import { fetchByTenantId, insertRow, unwrapResult } from "./repositorySupport.js";
import { mapSupabaseFinanceError } from "./errorMapping.js";

/**
 * @param {object} client
 */
export function createSupabaseFinanceEventRepository(client) {
  const table = FINANCE_TABLES.events;
  return Object.freeze({
    async append(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizeEventForWrite(input, tid);
      try {
        const row = await insertRow(client, table, eventToRow(record), "FinancialEvent", tid);
        return eventFromRow(row);
      } catch (err) {
        if (
          err instanceof FinanceError &&
          err.code === FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT
        ) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.EVENT_APPEND_CONFLICT,
            "Duplicate Finance event id.",
            { tenantId: tid, eventId: record.id, table }
          );
        }
        throw mapSupabaseFinanceError(err, {
          entity: "FinancialEvent",
          tenantId: tid,
          table,
          operation: "append",
        });
      }
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "FinancialEvent");
      return eventFromRow(row);
    },
    async list(queryInput) {
      const query = assertEventListBounds(createBoundedListQuery(queryInput));
      let builder = applyTenantIdFilter(client.from(table).select("*"), query.tenantId);
      if (query.occurredFrom) builder = builder.gte("occurred_at", query.occurredFrom);
      if (query.occurredTo) builder = builder.lte("occurred_at", query.occurredTo);
      if (query.paymentId) builder = builder.eq("payment_id", query.paymentId);
      // correlationId via cursor field reuse is not used; accept correlationId on input
      if (queryInput?.correlationId) {
        builder = builder.eq("correlation_id", queryInput.correlationId);
      }
      const sortKey =
        query.sort === "createdAtAsc" || query.sort === "createdAtDesc"
          ? query.sort === "createdAtDesc"
            ? "occurredAtDesc"
            : "occurredAtAsc"
          : query.sort;
      const data = await unwrapResult(
        applyOrderAndLimit(builder, resolveSort(sortKey), query.limit),
        { entity: "FinancialEvent", tenantId: query.tenantId, table, operation: "list" }
      );
      return Object.freeze((data || []).map(eventFromRow));
    },
    async listByCorrelationId(tenantId, correlationId, queryInput = {}) {
      return this.list({
        ...queryInput,
        tenantId,
        correlationId,
        sort: queryInput.sort ?? "occurredAtAsc",
      });
    },
    async update() {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Financial events are append-only and cannot be mutated.",
        { entity: "FinancialEvent" }
      );
    },
    async delete() {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Financial events cannot be deleted through the Finance adapter.",
        { entity: "FinancialEvent" }
      );
    },
  });
}
