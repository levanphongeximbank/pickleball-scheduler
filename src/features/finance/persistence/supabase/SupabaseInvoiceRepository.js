/**
 * Supabase Finance invoice repository (Phase 1G).
 *
 * Invoice + items is multi-record: create with items requires atomic multi-record
 * capability (injected transactional executor). Empty-item invoices are single-statement.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  createBoundedListQuery,
  requireTenantScope,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  invoiceFromRow,
  invoiceItemToRow,
  invoiceToRow,
  normalizeInvoiceForWrite,
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
 * @param {{ supportsAtomicMultiRecord?: boolean, runAtomic?: Function }} [capabilities]
 */
export function createSupabaseInvoiceRepository(client, capabilities = {}) {
  const table = FINANCE_TABLES.invoices;
  const itemsTable = FINANCE_TABLES.invoiceItems;

  async function loadItems(tenantId, invoiceId) {
    const data = await unwrapResult(
      applyTenantIdFilter(client.from(itemsTable).select("*"), tenantId)
        .eq("invoice_id", invoiceId),
      { entity: "InvoiceItem", tenantId, table: itemsTable, operation: "listByInvoice" }
    );
    return data || [];
  }

  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = normalizeInvoiceForWrite(input, tid);
      const items = Array.isArray(record.items) ? record.items : [];

      if (items.length > 0 && !capabilities.supportsAtomicMultiRecord) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
          "Invoice create with line items requires an atomic multi-record capability (injected transactional executor).",
          {
            entity: "Invoice",
            tenantId: tid,
            itemCount: items.length,
            operation: "createWithItems",
          }
        );
      }

      if (items.length > 0 && typeof capabilities.runAtomic === "function") {
        return capabilities.runAtomic(async () => {
          const row = await insertRow(client, table, invoiceToRow(record), "Invoice", tid);
          for (const item of items) {
            await insertRow(
              client,
              itemsTable,
              invoiceItemToRow(item, tid, record.id),
              "InvoiceItem",
              tid
            );
          }
          const itemRows = await loadItems(tid, record.id);
          return invoiceFromRow(row, itemRows);
        });
      }

      const row = await insertRow(client, table, invoiceToRow(record), "Invoice", tid);
      return invoiceFromRow(row, []);
    },
    async getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const row = await fetchByTenantId(client, table, tid, id, "Invoice");
      const itemRows = await loadItems(tid, id);
      return invoiceFromRow(row, itemRows);
    },
    async findByBusinessReference(tenantId, businessReference) {
      const tid = requireTenantScope(tenantId);
      const data = await unwrapResult(
        applyTenantIdFilter(client.from(table).select("*"), tid)
          .eq("business_reference", businessReference)
          .maybeSingle(),
        { entity: "Invoice", tenantId: tid, table, operation: "findByBusinessReference" }
      );
      if (!data) return null;
      const itemRows = await loadItems(tid, data.id);
      return invoiceFromRow(data, itemRows);
    },
    async update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      const current = await this.getById(tid, id);
      if (Array.isArray(nextInput?.items) && nextInput.items.length > 0) {
        // Item rewrite is multi-record; refuse without atomic capability
        if (!capabilities.supportsAtomicMultiRecord) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
            "Invoice item mutation requires atomic multi-record capability.",
            { entity: "Invoice", tenantId: tid, id }
          );
        }
      }
      const merged = normalizeInvoiceForWrite(
        {
          ...current,
          ...nextInput,
          id: current.id,
          tenantId: tid,
          version: current.version,
          createdAt: current.createdAt,
          items: nextInput?.items ?? current.items,
        },
        tid
      );
      const patch = invoiceToRow({ ...merged, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        id,
        expectedVersion,
        patch,
        "Invoice"
      );
      const itemRows = await loadItems(tid, id);
      return invoiceFromRow(row, itemRows);
    },
    async list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      let builder = applyTenantIdFilter(client.from(table).select("*"), query.tenantId);
      if (query.status) builder = builder.eq("status", query.status);
      const data = await unwrapResult(
        applyOrderAndLimit(builder, resolveSort(query.sort), query.limit),
        { entity: "Invoice", tenantId: query.tenantId, table, operation: "list" }
      );
      const results = [];
      for (const row of data || []) {
        const itemRows = await loadItems(query.tenantId, row.id);
        results.push(invoiceFromRow(row, itemRows));
      }
      return Object.freeze(results);
    },
  });
}
