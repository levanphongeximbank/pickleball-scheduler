import { createId } from "../../../utils/id.js";
import { INVOICE_STATUS } from "../constants/billingConstants.js";
import { BillingAuditService } from "./billingAuditService.js";
import { ensureCollection, resolveNow, updateInCollection, writeCollection } from "./billingStoreUtils.js";

let invoiceSequence = 0;

export class InvoiceService {
  constructor({ store } = {}) {
    this.store = store;
    this.audit = new BillingAuditService({ store });
  }

  generateInvoiceNumber() {
    invoiceSequence += 1;
    const now = new Date();
    return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(invoiceSequence).padStart(5, "0")}`;
  }

  createInvoice({ tenantId, subscriptionId, amount = 0, currency = "VND", status = INVOICE_STATUS.ISSUED, note = "", actorUserId = null, items = [] } = {}) {
    const invoices = ensureCollection(this.store, "invoices", []);
    const now = resolveNow();
    const invoice = {
      id: `invoice-${createId()}`,
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      invoice_number: this.generateInvoiceNumber(),
      status,
      amount,
      currency,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: amount,
      issue_date: now.toISOString(),
      due_date: addDaysIso(now, 7),
      paid_at: null,
      note,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    writeCollection(this.store, "invoices", [...invoices, invoice]);

    if (items.length > 0) {
      const invoiceItems = ensureCollection(this.store, "invoiceItems", []);
      writeCollection(
        this.store,
        "invoiceItems",
        [
          ...invoiceItems,
          ...items.map((item) => ({
            id: `item-${createId()}`,
            invoice_id: invoice.id,
            tenant_id: tenantId,
            description: item.description || "Subscription",
            quantity: item.quantity || 1,
            unit_amount: item.unit_amount || amount,
            total_amount: (item.quantity || 1) * (item.unit_amount || amount),
            created_at: now.toISOString(),
          })),
        ]
      );
    }

    this.audit.log({
      tenantId,
      actorUserId,
      eventType: "InvoiceCreated",
      entityType: "invoice",
      entityId: invoice.id,
      after: { status: invoice.status, amount },
    });

    return invoice;
  }

  getById(id) {
    return ensureCollection(this.store, "invoices", []).find((item) => item.id === id) || null;
  }

  listByTenant(tenantId) {
    return ensureCollection(this.store, "invoices", []).filter((item) => item.tenant_id === tenantId);
  }

  listAll() {
    return ensureCollection(this.store, "invoices", []);
  }

  issueInvoice(id, { actorUserId } = {}) {
    const invoice = updateInCollection(this.store, "invoices", id, (item) => ({
      ...item,
      status: INVOICE_STATUS.ISSUED,
      updated_at: new Date().toISOString(),
    }));
    this.audit.log({
      tenantId: invoice?.tenant_id,
      actorUserId,
      eventType: "InvoiceIssued",
      entityType: "invoice",
      entityId: id,
      after: { status: INVOICE_STATUS.ISSUED },
    });
    return invoice;
  }

  markPaid(id, { actorUserId } = {}) {
    const invoice = updateInCollection(this.store, "invoices", id, (item) => ({
      ...item,
      status: INVOICE_STATUS.PAID,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    this.audit.log({
      tenantId: invoice?.tenant_id,
      actorUserId,
      eventType: "InvoicePaid",
      entityType: "invoice",
      entityId: id,
      after: { status: INVOICE_STATUS.PAID },
    });
    return invoice;
  }

  markOverdue(id) {
    return updateInCollection(this.store, "invoices", id, (item) => ({
      ...item,
      status: INVOICE_STATUS.OVERDUE,
      updated_at: new Date().toISOString(),
    }));
  }

  cancelInvoice(id, { actorUserId } = {}) {
    const invoice = updateInCollection(this.store, "invoices", id, (item) => ({
      ...item,
      status: INVOICE_STATUS.CANCELLED,
      updated_at: new Date().toISOString(),
    }));
    this.audit.log({
      tenantId: invoice?.tenant_id,
      actorUserId,
      eventType: "InvoiceCancelled",
      entityType: "invoice",
      entityId: id,
      after: { status: INVOICE_STATUS.CANCELLED },
    });
    return invoice;
  }
}

function addDaysIso(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}
