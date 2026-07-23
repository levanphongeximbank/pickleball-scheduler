/**
 * Invoice + Invoice Item lifecycle (Phase 1B).
 *
 * Invoice status is NOT authoritative provider payment evidence.
 *
 * States:
 * - DRAFT → ISSUED | VOID
 * - ISSUED → PARTIALLY_PAID | PAID | VOID
 * - PARTIALLY_PAID → PAID | VOID
 * - PAID → (none)  [terminal for payment representation]
 * - VOID → (none)
 *
 * Issued invoices cannot be silently rewritten (items/totals immutable).
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import {
  addMoney,
  createMoney,
  compareMoney,
  serializeMoney,
  zeroMoney,
} from "./money.js";

export const INVOICE_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  VOID: "VOID",
});

export const INVOICE_STATUS_VALUES = Object.freeze(Object.values(INVOICE_STATUS));

export const INVOICE_TERMINAL_STATUSES = Object.freeze([
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.VOID,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const INVOICE_ALLOWED_TRANSITIONS = Object.freeze({
  [INVOICE_STATUS.DRAFT]: Object.freeze([INVOICE_STATUS.ISSUED, INVOICE_STATUS.VOID]),
  [INVOICE_STATUS.ISSUED]: Object.freeze([
    INVOICE_STATUS.PARTIALLY_PAID,
    INVOICE_STATUS.PAID,
    INVOICE_STATUS.VOID,
  ]),
  [INVOICE_STATUS.PARTIALLY_PAID]: Object.freeze([
    INVOICE_STATUS.PAID,
    INVOICE_STATUS.VOID,
  ]),
  [INVOICE_STATUS.PAID]: Object.freeze([]),
  [INVOICE_STATUS.VOID]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFERENCE,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function optionalId(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFERENCE,
      "Optional reference must be a non-empty string when provided."
    );
  }
  return value.trim();
}

/**
 * @param {object} input
 * @param {string} currency
 * @returns {Readonly<object>}
 */
export function createInvoiceItem(input = {}, currency) {
  const itemId = requireId(input.itemId ?? input.id, "itemId");
  const quantityRaw = input.quantity == null ? 1 : input.quantity;
  if (typeof quantityRaw !== "number" || !Number.isSafeInteger(quantityRaw) || quantityRaw < 1) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Invoice item quantity must be a positive safe integer.",
      { field: "quantity" }
    );
  }

  const itemCurrency =
    currency ||
    input.currency ||
    input.unitAmount?.currency ||
    input.amount?.currency ||
    input.lineTotal?.currency;

  if (currency && input.currency) {
    const declared = String(input.currency).trim();
    if (declared && declared !== currency) {
      // Reject mismatched item currency even before support checks when invoice currency is fixed.
      if (declared.toUpperCase() !== currency) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
          "Invoice item currency must match invoice currency.",
          { expected: currency, received: declared }
        );
      }
      if (declared !== declared.toUpperCase()) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY,
          "Currency must be uppercase ISO-4217 (e.g. VND).",
          { field: "currency", received: declared }
        );
      }
    }
  }

  let money;
  if (
    input.amountMinor != null ||
    input.unitAmount?.amountMinor != null ||
    input.amount?.amountMinor != null
  ) {
    money = createMoney(
      input.amountMinor ?? input.unitAmount?.amountMinor ?? input.amount?.amountMinor,
      itemCurrency
    );
  } else if (input.lineTotal?.amountMinor != null) {
    // Re-hydrate from an already-normalized item: derive unit from line total.
    const line = createMoney(input.lineTotal.amountMinor, itemCurrency);
    if (line.amountMinor % quantityRaw !== 0) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "Cannot derive unit amount from lineTotal that is not divisible by quantity.",
        { field: "lineTotal" }
      );
    }
    money = createMoney(line.amountMinor / quantityRaw, itemCurrency);
  } else {
    money = createMoney(undefined, itemCurrency);
  }

  const description =
    input.description == null
      ? null
      : typeof input.description === "string"
        ? input.description.trim() || null
        : (() => {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_INPUT,
              "Invoice item description must be a string.",
              { field: "description" }
            );
          })();

  return Object.freeze({
    itemId,
    description,
    quantity: quantityRaw,
    unitAmount: serializeMoney(money),
    lineTotal: serializeMoney(
      createMoney(money.amountMinor * quantityRaw, money.currency)
    ),
    feeId: optionalId(input.feeId),
    obligationId: optionalId(input.obligationId),
  });
}

/**
 * @param {readonly object[]} items
 * @param {string} currency
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function sumInvoiceItems(items, currency) {
  if (!Array.isArray(items) || items.length === 0) {
    return serializeMoney(zeroMoney(currency));
  }
  let total = createMoney(0, currency);
  for (const raw of items) {
    const item = createInvoiceItem(raw, currency);
    if (item.lineTotal.currency !== currency) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
        "Invoice items must share one currency.",
        { expected: currency, received: item.lineTotal.currency }
      );
    }
    total = addMoney(total, item.lineTotal);
  }
  return serializeMoney(total);
}

/**
 * @param {object} invoice
 * @param {string} nextStatus
 */
function assertTransition(invoice, nextStatus) {
  const allowed = INVOICE_ALLOWED_TRANSITIONS[invoice.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid invoice transition ${invoice.status} → ${nextStatus}.`,
      { invoiceId: invoice.invoiceId, from: invoice.status, to: nextStatus }
    );
  }
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createInvoice(input = {}) {
  const invoiceId = requireId(input.invoiceId ?? input.id, "invoiceId");
  const tenantId = requireId(input.tenantId, "tenantId");
  const currency = createMoney(
    input.amountMinor ?? input.total?.amountMinor ?? 0,
    input.currency ?? input.total?.currency
  ).currency;

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items = Object.freeze(rawItems.map((item) => createInvoiceItem(item, currency)));
  const computedTotal = sumInvoiceItems(items, currency);

  if (
    input.total != null ||
    input.amountMinor != null
  ) {
    const declared = createMoney(
      input.amountMinor ?? input.total?.amountMinor,
      input.currency ?? input.total?.currency ?? currency
    );
    if (
      declared.currency !== computedTotal.currency ||
      declared.amountMinor !== computedTotal.amountMinor
    ) {
      // When items exist, total must equal sum; when no items and declared total provided, use declared only if empty draft allowed later.
      if (items.length > 0) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "Invoice total must equal the sum of invoice items.",
          {
            invoiceId,
            declaredMinor: declared.amountMinor,
            computedMinor: computedTotal.amountMinor,
          }
        );
      }
    }
  }

  const total =
    items.length > 0
      ? computedTotal
      : serializeMoney(
          createMoney(
            input.amountMinor ?? input.total?.amountMinor ?? 0,
            currency
          )
        );

  const status =
    input.status == null ? INVOICE_STATUS.DRAFT : String(input.status).trim();
  if (!INVOICE_STATUS_VALUES.includes(status)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid invoice status: ${status}.`,
      { field: "status" }
    );
  }

  const amountPaid = createMoney(
    input.amountPaidMinor ?? input.amountPaid?.amountMinor ?? 0,
    currency
  );

  if (compareMoney(amountPaid, total) > 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.OVERPAYMENT,
      "Invoice amountPaid cannot exceed total.",
      { invoiceId }
    );
  }

  return Object.freeze({
    invoiceId,
    tenantId,
    venueId: optionalId(input.venueId),
    clubId: optionalId(input.clubId),
    obligationId: optionalId(input.obligationId),
    currency,
    items,
    total,
    amountPaid: serializeMoney(amountPaid),
    status,
    issuedAt: optionalId(input.issuedAt),
    voidedAt: optionalId(input.voidedAt),
    voidReason: optionalId(input.voidReason),
    createdAt: optionalId(input.createdAt),
    updatedAt: optionalId(input.updatedAt),
    /**
     * Invoice payment status is a Finance bookkeeping hint only —
     * not provider payment evidence.
     */
    paymentStatusHint: status,
  });
}

/**
 * @param {object} invoice
 * @param {{ issuedAt?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function issueInvoice(invoice, meta = {}) {
  const current = createInvoice(invoice);
  assertTransition(current, INVOICE_STATUS.ISSUED);

  if (!current.items.length) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Cannot issue an empty invoice.",
      { invoiceId: current.invoiceId }
    );
  }
  if (current.total.amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Cannot issue an invoice with non-positive total.",
      { invoiceId: current.invoiceId }
    );
  }

  return Object.freeze({
    ...current,
    status: INVOICE_STATUS.ISSUED,
    paymentStatusHint: INVOICE_STATUS.ISSUED,
    issuedAt: optionalId(meta.issuedAt) || current.issuedAt || null,
  });
}

/**
 * Prevent silent rewrite of issued invoice items/totals.
 *
 * @param {object} invoice
 * @param {object} nextInvoice
 */
export function assertIssuedInvoiceImmutable(invoice, nextInvoice) {
  const current = createInvoice(invoice);
  if (current.status === INVOICE_STATUS.DRAFT) return;

  const next = createInvoice({
    ...nextInvoice,
    status: current.status,
    total: undefined,
    amountMinor: undefined,
    amountPaid: current.amountPaid,
    amountPaidMinor: current.amountPaid.amountMinor,
  });
  if (
    current.currency !== next.currency ||
    current.total.amountMinor !== next.total.amountMinor ||
    current.items.length !== next.items.length
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
      "Issued invoice cannot be rewritten.",
      { invoiceId: current.invoiceId }
    );
  }
  for (let i = 0; i < current.items.length; i += 1) {
    const a = current.items[i];
    const b = next.items[i];
    if (
      a.itemId !== b.itemId ||
      a.lineTotal.amountMinor !== b.lineTotal.amountMinor ||
      a.lineTotal.currency !== b.lineTotal.currency
    ) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Issued invoice items cannot be rewritten.",
        { invoiceId: current.invoiceId, itemId: a.itemId }
      );
    }
  }
}

/**
 * Record bookkeeping payment against an issued invoice (not provider evidence).
 *
 * @param {object} invoice
 * @param {{ amountMinor: number, currency?: string }} payment
 * @returns {Readonly<object>}
 */
export function applyInvoicePaymentHint(invoice, payment = {}) {
  const current = createInvoice(invoice);
  if (
    current.status !== INVOICE_STATUS.ISSUED &&
    current.status !== INVOICE_STATUS.PARTIALLY_PAID
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Cannot apply payment hint to invoice in status ${current.status}.`,
      { invoiceId: current.invoiceId, status: current.status }
    );
  }

  const pay = createMoney(payment.amountMinor, payment.currency ?? current.currency);
  if (pay.currency !== current.currency) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
      "Payment currency must match invoice currency.",
      { invoiceId: current.invoiceId }
    );
  }
  if (pay.amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Payment amount must be positive.",
      { invoiceId: current.invoiceId }
    );
  }

  const newPaid = addMoney(current.amountPaid, pay);
  if (compareMoney(newPaid, current.total) > 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.OVERPAYMENT,
      "Invoice payment would exceed total.",
      { invoiceId: current.invoiceId }
    );
  }

  const fullyPaid = compareMoney(newPaid, current.total) === 0;
  const nextStatus = fullyPaid ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID;
  assertTransition(current, nextStatus);

  return Object.freeze({
    ...current,
    amountPaid: serializeMoney(newPaid),
    status: nextStatus,
    paymentStatusHint: nextStatus,
  });
}

/**
 * @param {object} invoice
 * @param {{ voidedAt?: string, reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function voidInvoice(invoice, meta = {}) {
  const current = createInvoice(invoice);
  assertTransition(current, INVOICE_STATUS.VOID);

  if (current.status === INVOICE_STATUS.PAID) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      "Paid invoice cannot be voided.",
      { invoiceId: current.invoiceId }
    );
  }

  return Object.freeze({
    ...current,
    status: INVOICE_STATUS.VOID,
    paymentStatusHint: INVOICE_STATUS.VOID,
    voidedAt: optionalId(meta.voidedAt) || current.voidedAt || null,
    voidReason:
      meta.reason == null || meta.reason === ""
        ? current.voidReason
        : String(meta.reason).trim(),
  });
}
