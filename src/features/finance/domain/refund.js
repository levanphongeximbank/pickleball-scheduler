/**
 * Refund lifecycle (Phase 1B).
 *
 * requested → approved | rejected
 * approved → completed | rejected
 * rejected → (none)
 * completed → (none)
 *
 * Completion requires evidence metadata. Completed refunds are immutable.
 * Multiple partial refunds are representable via separate refund records
 * constrained by the payment's remaining refundable amount.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createMoney, serializeMoney, compareMoney } from "./money.js";
import {
  createPayment,
  getRefundableAmount,
  recordPaymentRefund,
  PAYMENT_STATUS,
} from "./payment.js";

export const REFUND_STATUS = Object.freeze({
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
});

export const REFUND_STATUS_VALUES = Object.freeze(Object.values(REFUND_STATUS));

export const REFUND_TERMINAL_STATUSES = Object.freeze([
  REFUND_STATUS.REJECTED,
  REFUND_STATUS.COMPLETED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const REFUND_ALLOWED_TRANSITIONS = Object.freeze({
  [REFUND_STATUS.REQUESTED]: Object.freeze([
    REFUND_STATUS.APPROVED,
    REFUND_STATUS.REJECTED,
  ]),
  [REFUND_STATUS.APPROVED]: Object.freeze([
    REFUND_STATUS.COMPLETED,
    REFUND_STATUS.REJECTED,
  ]),
  [REFUND_STATUS.REJECTED]: Object.freeze([]),
  [REFUND_STATUS.COMPLETED]: Object.freeze([]),
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
 * @param {object} refund
 * @param {string} nextStatus
 */
function assertTransition(refund, nextStatus) {
  const allowed = REFUND_ALLOWED_TRANSITIONS[refund.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid refund transition ${refund.status} → ${nextStatus}.`,
      { refundId: refund.refundId, from: refund.status, to: nextStatus }
    );
  }
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createRefund(input = {}) {
  const refundId = requireId(input.refundId ?? input.id, "refundId");
  const paymentId = requireId(input.paymentId, "paymentId");
  const tenantId = requireId(input.tenantId, "tenantId");
  const amount = createMoney(
    input.amountMinor ?? input.amount?.amountMinor,
    input.currency ?? input.amount?.currency
  );
  if (amount.amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
      "Refund amount must be positive.",
      { refundId }
    );
  }

  const status =
    input.status == null ? REFUND_STATUS.REQUESTED : String(input.status).trim();
  if (!REFUND_STATUS_VALUES.includes(status)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid refund status: ${status}.`,
      { field: "status" }
    );
  }

  return Object.freeze({
    refundId,
    paymentId,
    tenantId,
    venueId: optionalId(input.venueId),
    clubId: optionalId(input.clubId),
    amount: serializeMoney(amount),
    currency: amount.currency,
    status,
    reason: optionalId(input.reason),
    evidenceRef: optionalId(input.evidenceRef),
    auditEvidenceRef: optionalId(input.auditEvidenceRef),
    requestedAt: optionalId(input.requestedAt),
    approvedAt: optionalId(input.approvedAt),
    rejectedAt: optionalId(input.rejectedAt),
    completedAt: optionalId(input.completedAt),
  });
}

/**
 * Request a refund against a confirmed payment without exceeding remaining refundable.
 *
 * @param {object} payment
 * @param {{
 *   refundId: string,
 *   amountMinor: number,
 *   currency?: string,
 *   reason?: string,
 *   requestedAt?: string
 * }} input
 * @returns {Readonly<{ refund: object, payment: object }>}
 */
export function requestRefund(payment, input = {}) {
  const p = createPayment(payment);
  if (p.status !== PAYMENT_STATUS.CONFIRMED) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.NON_REFUNDABLE_PAYMENT,
      "Refunds require a confirmed payment.",
      { paymentId: p.paymentId, status: p.status }
    );
  }

  const refundMoney = createMoney(
    input.amountMinor,
    input.currency ?? p.currency
  );
  if (refundMoney.currency !== p.currency) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
      "Refund currency must match payment currency.",
      { paymentId: p.paymentId }
    );
  }

  const remaining = getRefundableAmount(p, {
    reservedInFlightMinor: input.reservedInFlightMinor ?? 0,
  });
  if (compareMoney(refundMoney, remaining) > 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
      "Refund amount exceeds remaining refundable amount.",
      {
        paymentId: p.paymentId,
        remainingMinor: remaining.amountMinor,
        attemptedMinor: refundMoney.amountMinor,
      }
    );
  }

  const refund = createRefund({
    refundId: input.refundId,
    paymentId: p.paymentId,
    tenantId: p.tenantId,
    venueId: p.venueId,
    clubId: p.clubId,
    amountMinor: refundMoney.amountMinor,
    currency: refundMoney.currency,
    status: REFUND_STATUS.REQUESTED,
    reason: input.reason,
    requestedAt: input.requestedAt,
  });

  return Object.freeze({ refund, payment: p });
}

/**
 * @param {object} refund
 * @param {{ approvedAt?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function approveRefund(refund, meta = {}) {
  const current = createRefund(refund);
  assertTransition(current, REFUND_STATUS.APPROVED);
  return Object.freeze({
    ...current,
    status: REFUND_STATUS.APPROVED,
    approvedAt: optionalId(meta.approvedAt) || current.approvedAt || null,
  });
}

/**
 * @param {object} refund
 * @param {{ rejectedAt?: string, reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function rejectRefund(refund, meta = {}) {
  const current = createRefund(refund);
  assertTransition(current, REFUND_STATUS.REJECTED);
  return Object.freeze({
    ...current,
    status: REFUND_STATUS.REJECTED,
    rejectedAt: optionalId(meta.rejectedAt) || current.rejectedAt || null,
    reason:
      meta.reason == null || meta.reason === ""
        ? current.reason
        : String(meta.reason).trim(),
  });
}

/**
 * Complete an approved refund. Requires evidence. Updates payment.refundedAmount only.
 *
 * @param {object} refund
 * @param {object} payment
 * @param {{ evidenceRef: string, auditEvidenceRef?: string, completedAt?: string }} evidence
 * @returns {Readonly<{ refund: object, payment: object }>}
 */
export function completeRefund(refund, payment, evidence = {}) {
  const current = createRefund(refund);
  assertTransition(current, REFUND_STATUS.COMPLETED);

  const evidenceRef = optionalId(evidence.evidenceRef);
  if (!evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED,
      "Refund completion requires evidenceRef.",
      { refundId: current.refundId }
    );
  }

  const p = createPayment(payment);
  if (p.paymentId !== current.paymentId) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFERENCE,
      "Refund paymentId does not match payment.",
      { refundId: current.refundId }
    );
  }

  const updatedPayment = recordPaymentRefund(p, {
    amountMinor: current.amount.amountMinor,
    currency: current.currency,
  });

  const completed = Object.freeze({
    ...current,
    status: REFUND_STATUS.COMPLETED,
    evidenceRef,
    auditEvidenceRef:
      optionalId(evidence.auditEvidenceRef) || current.auditEvidenceRef,
    completedAt: optionalId(evidence.completedAt) || null,
  });

  return Object.freeze({
    refund: completed,
    payment: updatedPayment,
  });
}

/**
 * @param {object} refund
 */
export function assertCompletedRefundImmutable(refund) {
  const current = createRefund(refund);
  if (current.status !== REFUND_STATUS.COMPLETED) return;
  throw new FinanceError(
    FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
    "Completed refunds are immutable.",
    { refundId: current.refundId }
  );
}
