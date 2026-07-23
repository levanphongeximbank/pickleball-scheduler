/**
 * Payment lifecycle (Phase 1B).
 *
 * Statuses align with Finance events:
 * PENDING → CONFIRMED | FAILED | CANCELLED | EXPIRED
 *
 * Confirmed payment cannot be confirmed again as a new financial effect.
 * Refund status is NOT represented by rewriting the original payment amount.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createMoney, serializeMoney, compareMoney, subtractMoney } from "./money.js";
import {
  createPaymentAttempt,
  confirmPaymentAttempt,
} from "./paymentAttempt.js";

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
});

export const PAYMENT_STATUS_VALUES = Object.freeze(Object.values(PAYMENT_STATUS));

export const PAYMENT_TERMINAL_STATUSES = Object.freeze([
  PAYMENT_STATUS.CONFIRMED,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.CANCELLED,
  PAYMENT_STATUS.EXPIRED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const PAYMENT_ALLOWED_TRANSITIONS = Object.freeze({
  [PAYMENT_STATUS.PENDING]: Object.freeze([
    PAYMENT_STATUS.CONFIRMED,
    PAYMENT_STATUS.FAILED,
    PAYMENT_STATUS.CANCELLED,
    PAYMENT_STATUS.EXPIRED,
  ]),
  [PAYMENT_STATUS.CONFIRMED]: Object.freeze([]),
  [PAYMENT_STATUS.FAILED]: Object.freeze([]),
  [PAYMENT_STATUS.CANCELLED]: Object.freeze([]),
  [PAYMENT_STATUS.EXPIRED]: Object.freeze([]),
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
 * @param {object} payment
 * @param {string} nextStatus
 */
function assertTransition(payment, nextStatus) {
  const allowed = PAYMENT_ALLOWED_TRANSITIONS[payment.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid payment transition ${payment.status} → ${nextStatus}.`,
      { paymentId: payment.paymentId, from: payment.status, to: nextStatus }
    );
  }
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createPayment(input = {}) {
  const paymentId = requireId(input.paymentId ?? input.id, "paymentId");
  const tenantId = requireId(input.tenantId, "tenantId");
  const amount = createMoney(
    input.amountMinor ?? input.amount?.amountMinor,
    input.currency ?? input.amount?.currency
  );

  const status =
    input.status == null ? PAYMENT_STATUS.PENDING : String(input.status).trim();
  if (!PAYMENT_STATUS_VALUES.includes(status)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid payment status: ${status}.`,
      { field: "status" }
    );
  }

  const refundedAmount = createMoney(
    input.refundedAmountMinor ?? input.refundedAmount?.amountMinor ?? 0,
    amount.currency
  );
  if (compareMoney(refundedAmount, amount) > 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
      "Refunded amount cannot exceed payment amount.",
      { paymentId }
    );
  }

  const attempts = Array.isArray(input.attempts)
    ? Object.freeze(input.attempts.map((a) => createPaymentAttempt({
        ...a,
        paymentId: a.paymentId ?? paymentId,
        tenantId: a.tenantId ?? tenantId,
        currency: a.currency ?? amount.currency,
        amountMinor: a.amountMinor ?? a.amount?.amountMinor ?? amount.amountMinor,
      })))
    : Object.freeze([]);

  return Object.freeze({
    paymentId,
    paymentReference: optionalId(input.paymentReference) || paymentId,
    tenantId,
    venueId: optionalId(input.venueId),
    clubId: optionalId(input.clubId),
    invoiceId: optionalId(input.invoiceId),
    obligationId: optionalId(input.obligationId),
    amount: serializeMoney(amount),
    currency: amount.currency,
    /** Original confirmed amount — never rewritten by refunds. */
    refundedAmount: serializeMoney(refundedAmount),
    status,
    providerReference: optionalId(input.providerReference),
    providerTransactionReference: optionalId(input.providerTransactionReference),
    idempotencyKey: optionalId(input.idempotencyKey),
    evidenceRef: optionalId(input.evidenceRef),
    auditEvidenceRef: optionalId(input.auditEvidenceRef),
    confirmedAttemptId: optionalId(input.confirmedAttemptId),
    /**
     * Application settlement bookkeeping: true after obligation/invoice
     * settlement effects for this confirmed payment have been applied.
     * Not a durable DB transaction marker — Foundation reconciliation aid.
     */
    settlementEffectApplied: Boolean(input.settlementEffectApplied),
    obligationSettlementApplied: Boolean(input.obligationSettlementApplied),
    invoiceSettlementApplied: Boolean(input.invoiceSettlementApplied),
    attempts,
    createdAt: optionalId(input.createdAt),
    updatedAt: optionalId(input.updatedAt),
    confirmedAt: optionalId(input.confirmedAt),
  });
}

/**
 * @param {object} payment
 * @param {object} attemptInput
 * @returns {Readonly<object>}
 */
export function addPaymentAttempt(payment, attemptInput = {}) {
  const current = createPayment(payment);
  if (current.status === PAYMENT_STATUS.CONFIRMED) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT,
      "Cannot add attempts to a confirmed payment.",
      { paymentId: current.paymentId }
    );
  }
  if (
    current.status === PAYMENT_STATUS.CANCELLED ||
    current.status === PAYMENT_STATUS.EXPIRED
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Cannot add attempts to payment in status ${current.status}.`,
      { paymentId: current.paymentId, status: current.status }
    );
  }

  const nextNumber = current.attempts.length + 1;
  const attempt = createPaymentAttempt({
    ...attemptInput,
    paymentId: current.paymentId,
    tenantId: current.tenantId,
    attemptNumber: attemptInput.attemptNumber ?? nextNumber,
    amountMinor: attemptInput.amountMinor ?? current.amount.amountMinor,
    currency: attemptInput.currency ?? current.currency,
  });

  return Object.freeze({
    ...current,
    status: PAYMENT_STATUS.PENDING,
    attempts: Object.freeze([...current.attempts, attempt]),
  });
}

/**
 * Confirm payment via a pending attempt. Duplicate confirmation is rejected
 * (no second financial effect). Idempotent re-entry with the same confirmed
 * attempt returns the existing confirmed payment without a new effect flag.
 *
 * @param {object} payment
 * @param {{
 *   attemptId: string,
 *   evidenceRef: string,
 *   auditEvidenceRef?: string,
 *   providerTransactionReference?: string,
 *   confirmedAt?: string
 * }} evidence
 * @returns {Readonly<{ payment: object, financialEffectApplied: boolean }>}
 */
export function confirmPayment(payment, evidence = {}) {
  const current = createPayment(payment);
  const attemptId = requireId(evidence.attemptId, "attemptId");

  if (current.status === PAYMENT_STATUS.CONFIRMED) {
    if (current.confirmedAttemptId === attemptId) {
      return Object.freeze({
        payment: current,
        financialEffectApplied: false,
      });
    }
    throw new FinanceError(
      FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT,
      "Payment is already confirmed; cannot confirm again as a new effect.",
      { paymentId: current.paymentId }
    );
  }

  assertTransition(current, PAYMENT_STATUS.CONFIRMED);

  if (!optionalId(evidence.evidenceRef)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED,
      "Payment confirmation requires evidenceRef.",
      { paymentId: current.paymentId }
    );
  }

  const attemptIndex = current.attempts.findIndex((a) => a.attemptId === attemptId);
  if (attemptIndex < 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFERENCE,
      "attemptId does not belong to this payment.",
      { paymentId: current.paymentId, attemptId }
    );
  }

  const confirmedAttempt = confirmPaymentAttempt(current.attempts[attemptIndex], evidence);
  const nextAttempts = current.attempts.map((a, i) =>
    i === attemptIndex ? confirmedAttempt : a
  );

  let providerTxn = current.providerTransactionReference;
  const incomingTxn = optionalId(evidence.providerTransactionReference);
  if (providerTxn && incomingTxn && providerTxn !== incomingTxn) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
      "providerTransactionReference is immutable once set.",
      { paymentId: current.paymentId }
    );
  }
  if (!providerTxn) {
    providerTxn =
      incomingTxn || confirmedAttempt.providerTransactionReference || null;
  }

  const next = Object.freeze({
    ...current,
    status: PAYMENT_STATUS.CONFIRMED,
    evidenceRef: evidence.evidenceRef.trim(),
    auditEvidenceRef:
      optionalId(evidence.auditEvidenceRef) || current.auditEvidenceRef,
    providerTransactionReference: providerTxn,
    confirmedAttemptId: attemptId,
    confirmedAt: optionalId(evidence.confirmedAt) || null,
    attempts: Object.freeze(nextAttempts),
  });

  return Object.freeze({
    payment: next,
    financialEffectApplied: true,
  });
}

/**
 * @param {object} payment
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function failPayment(payment, meta = {}) {
  const current = createPayment(payment);
  assertTransition(current, PAYMENT_STATUS.FAILED);
  return Object.freeze({
    ...current,
    status: PAYMENT_STATUS.FAILED,
    failureReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * @param {object} payment
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function cancelPayment(payment, meta = {}) {
  const current = createPayment(payment);
  assertTransition(current, PAYMENT_STATUS.CANCELLED);
  return Object.freeze({
    ...current,
    status: PAYMENT_STATUS.CANCELLED,
    cancellationReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * @param {object} payment
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function expirePayment(payment, meta = {}) {
  const current = createPayment(payment);
  assertTransition(current, PAYMENT_STATUS.EXPIRED);
  return Object.freeze({
    ...current,
    status: PAYMENT_STATUS.EXPIRED,
    expirationReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * Remaining refundable amount (does not mutate payment amount).
 *
 * Completed refunds are reflected in payment.refundedAmount.
 * Callers may also pass reservedInFlightMinor for REQUESTED/APPROVED refunds
 * that have not yet completed (application-layer reservation).
 *
 * @param {object} payment
 * @param {{ reservedInFlightMinor?: number }} [options]
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function getRefundableAmount(payment, options = {}) {
  const current = createPayment(payment);
  if (current.status !== PAYMENT_STATUS.CONFIRMED) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.NON_REFUNDABLE_PAYMENT,
      "Only confirmed payments are refundable.",
      { paymentId: current.paymentId, status: current.status }
    );
  }
  const reservedRaw = options.reservedInFlightMinor ?? 0;
  if (
    typeof reservedRaw !== "number" ||
    !Number.isSafeInteger(reservedRaw) ||
    reservedRaw < 0
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
      "reservedInFlightMinor must be a non-negative safe integer.",
      { paymentId: current.paymentId, field: "reservedInFlightMinor" }
    );
  }
  const afterCompleted = subtractMoney(current.amount, current.refundedAmount);
  if (reservedRaw > afterCompleted.amountMinor) {
    return serializeMoney(createMoney(0, current.currency));
  }
  return serializeMoney(
    createMoney(afterCompleted.amountMinor - reservedRaw, current.currency)
  );
}

/**
 * Record a completed refund against refundedAmount only (payment.amount stays immutable).
 *
 * @param {object} payment
 * @param {{ amountMinor: number, currency?: string }} refund
 * @returns {Readonly<object>}
 */
export function recordPaymentRefund(payment, refund = {}) {
  const current = createPayment(payment);
  if (current.status !== PAYMENT_STATUS.CONFIRMED) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.NON_REFUNDABLE_PAYMENT,
      "Only confirmed payments can record refunds.",
      { paymentId: current.paymentId, status: current.status }
    );
  }
  const refundMoney = createMoney(
    refund.amountMinor,
    refund.currency ?? current.currency
  );
  if (refundMoney.currency !== current.currency) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
      "Refund currency must match payment currency.",
      { paymentId: current.paymentId }
    );
  }
  if (refundMoney.amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
      "Refund amount must be positive.",
      { paymentId: current.paymentId }
    );
  }
  const remaining = subtractMoney(current.amount, current.refundedAmount);
  if (compareMoney(refundMoney, remaining) > 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
      "Refund exceeds remaining refundable amount.",
      {
        paymentId: current.paymentId,
        remainingMinor: remaining.amountMinor,
        attemptedMinor: refundMoney.amountMinor,
      }
    );
  }

  const nextRefunded = createMoney(
    current.refundedAmount.amountMinor + refundMoney.amountMinor,
    current.currency
  );

  return Object.freeze({
    ...current,
    amount: current.amount,
    refundedAmount: serializeMoney(nextRefunded),
  });
}
