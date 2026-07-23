/**
 * Receipt representation (Phase 1B).
 * Issued only from a confirmed payment. No HTML/PDF/print rendering.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createMoney, serializeMoney } from "./money.js";
import { createPayment, PAYMENT_STATUS } from "./payment.js";

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
 * @returns {Readonly<object>}
 */
export function createReceipt(input = {}) {
  const receiptId = requireId(input.receiptId ?? input.id, "receiptId");
  const tenantId = requireId(input.tenantId, "tenantId");
  const paymentId = requireId(input.paymentId ?? input.paymentReference, "paymentId");
  const amount = createMoney(
    input.amountMinor ?? input.amount?.amountMinor,
    input.currency ?? input.amount?.currency
  );
  const issuedAt = requireId(input.issuedAt, "issuedAt");
  const evidenceRef = requireId(input.evidenceRef, "evidenceRef");

  return Object.freeze({
    receiptId,
    tenantId,
    venueId: optionalId(input.venueId),
    clubId: optionalId(input.clubId),
    paymentId,
    paymentReference: optionalId(input.paymentReference) || paymentId,
    amount: serializeMoney(amount),
    currency: amount.currency,
    issuedAt,
    evidenceRef,
    auditEvidenceRef: optionalId(input.auditEvidenceRef),
  });
}

/**
 * @param {object} receipt
 * @returns {{ receiptId: string, tenantId: string, paymentId: string, amountMinor: number, currency: string, issuedAt: string, evidenceRef: string }}
 */
export function serializeReceipt(receipt) {
  const r = createReceipt(receipt);
  return Object.freeze({
    receiptId: r.receiptId,
    tenantId: r.tenantId,
    venueId: r.venueId,
    clubId: r.clubId,
    paymentId: r.paymentId,
    paymentReference: r.paymentReference,
    amountMinor: r.amount.amountMinor,
    currency: r.currency,
    issuedAt: r.issuedAt,
    evidenceRef: r.evidenceRef,
    auditEvidenceRef: r.auditEvidenceRef,
  });
}

/**
 * Issue a receipt from a confirmed payment only.
 *
 * @param {object} payment
 * @param {{ receiptId: string, issuedAt: string, evidenceRef?: string, auditEvidenceRef?: string }} meta
 * @returns {Readonly<object>}
 */
export function issueReceiptFromPayment(payment, meta = {}) {
  const p = createPayment(payment);
  if (p.status !== PAYMENT_STATUS.CONFIRMED) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      "Receipt can only be issued from a confirmed payment.",
      { paymentId: p.paymentId, status: p.status }
    );
  }

  const evidenceRef = optionalId(meta.evidenceRef) || p.evidenceRef;
  if (!evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED,
      "Receipt requires evidenceRef from confirmation evidence.",
      { paymentId: p.paymentId }
    );
  }

  return createReceipt({
    receiptId: meta.receiptId,
    tenantId: p.tenantId,
    venueId: p.venueId,
    clubId: p.clubId,
    paymentId: p.paymentId,
    paymentReference: p.paymentReference,
    amountMinor: p.amount.amountMinor,
    currency: p.currency,
    issuedAt: meta.issuedAt,
    evidenceRef,
    auditEvidenceRef: optionalId(meta.auditEvidenceRef) || p.auditEvidenceRef,
  });
}
