/**
 * Payment Attempt lifecycle (Phase 1B).
 *
 * Multiple attempts may exist for one payment. A failed/cancelled/expired
 * attempt cannot later become successful — create a new attempt instead.
 * Provider transaction references, when set, are immutable.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createMoney, serializeMoney } from "./money.js";

export const PAYMENT_ATTEMPT_STATUS = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
});

export const PAYMENT_ATTEMPT_STATUS_VALUES = Object.freeze(
  Object.values(PAYMENT_ATTEMPT_STATUS)
);

export const PAYMENT_ATTEMPT_TERMINAL_STATUSES = Object.freeze([
  PAYMENT_ATTEMPT_STATUS.CONFIRMED,
  PAYMENT_ATTEMPT_STATUS.FAILED,
  PAYMENT_ATTEMPT_STATUS.CANCELLED,
  PAYMENT_ATTEMPT_STATUS.EXPIRED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const PAYMENT_ATTEMPT_ALLOWED_TRANSITIONS = Object.freeze({
  [PAYMENT_ATTEMPT_STATUS.PENDING]: Object.freeze([
    PAYMENT_ATTEMPT_STATUS.CONFIRMED,
    PAYMENT_ATTEMPT_STATUS.FAILED,
    PAYMENT_ATTEMPT_STATUS.CANCELLED,
    PAYMENT_ATTEMPT_STATUS.EXPIRED,
  ]),
  [PAYMENT_ATTEMPT_STATUS.CONFIRMED]: Object.freeze([]),
  [PAYMENT_ATTEMPT_STATUS.FAILED]: Object.freeze([]),
  [PAYMENT_ATTEMPT_STATUS.CANCELLED]: Object.freeze([]),
  [PAYMENT_ATTEMPT_STATUS.EXPIRED]: Object.freeze([]),
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
 * @param {object} attempt
 * @param {string} nextStatus
 */
function assertTransition(attempt, nextStatus) {
  const allowed = PAYMENT_ATTEMPT_ALLOWED_TRANSITIONS[attempt.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid payment attempt transition ${attempt.status} → ${nextStatus}.`,
      {
        attemptId: attempt.attemptId,
        from: attempt.status,
        to: nextStatus,
      }
    );
  }
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createPaymentAttempt(input = {}) {
  const attemptId = requireId(input.attemptId ?? input.id, "attemptId");
  const paymentId = requireId(input.paymentId, "paymentId");
  const amount = createMoney(
    input.amountMinor ?? input.amount?.amountMinor,
    input.currency ?? input.amount?.currency
  );

  const status =
    input.status == null
      ? PAYMENT_ATTEMPT_STATUS.PENDING
      : String(input.status).trim();
  if (!PAYMENT_ATTEMPT_STATUS_VALUES.includes(status)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid payment attempt status: ${status}.`,
      { field: "status" }
    );
  }

  const attemptNumberRaw = input.attemptNumber == null ? 1 : input.attemptNumber;
  if (
    typeof attemptNumberRaw !== "number" ||
    !Number.isSafeInteger(attemptNumberRaw) ||
    attemptNumberRaw < 1
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "attemptNumber must be a positive safe integer.",
      { field: "attemptNumber" }
    );
  }

  return Object.freeze({
    attemptId,
    paymentId,
    tenantId: requireId(input.tenantId, "tenantId"),
    attemptNumber: attemptNumberRaw,
    amount: serializeMoney(amount),
    currency: amount.currency,
    status,
    providerReference: optionalId(input.providerReference),
    providerTransactionReference: optionalId(input.providerTransactionReference),
    idempotencyKey: optionalId(input.idempotencyKey),
    evidenceRef: optionalId(input.evidenceRef),
    auditEvidenceRef: optionalId(input.auditEvidenceRef),
    createdAt: optionalId(input.createdAt),
    updatedAt: optionalId(input.updatedAt),
  });
}

/**
 * @param {object} attempt
 * @param {{
 *   evidenceRef: string,
 *   auditEvidenceRef?: string,
 *   providerTransactionReference?: string,
 *   confirmedAt?: string
 * }} evidence
 * @returns {Readonly<object>}
 */
export function confirmPaymentAttempt(attempt, evidence = {}) {
  const current = createPaymentAttempt(attempt);
  assertTransition(current, PAYMENT_ATTEMPT_STATUS.CONFIRMED);

  const evidenceRef = optionalId(evidence.evidenceRef);
  if (!evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED,
      "Confirmation requires evidenceRef.",
      { attemptId: current.attemptId }
    );
  }

  let providerTxn = current.providerTransactionReference;
  const incomingTxn = optionalId(evidence.providerTransactionReference);
  if (providerTxn && incomingTxn && providerTxn !== incomingTxn) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
      "providerTransactionReference is immutable once set.",
      { attemptId: current.attemptId }
    );
  }
  if (!providerTxn && incomingTxn) {
    providerTxn = incomingTxn;
  }

  return Object.freeze({
    ...current,
    status: PAYMENT_ATTEMPT_STATUS.CONFIRMED,
    evidenceRef,
    auditEvidenceRef:
      optionalId(evidence.auditEvidenceRef) || current.auditEvidenceRef,
    providerTransactionReference: providerTxn,
    confirmedAt: optionalId(evidence.confirmedAt) || null,
  });
}

/**
 * @param {object} attempt
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function failPaymentAttempt(attempt, meta = {}) {
  const current = createPaymentAttempt(attempt);
  assertTransition(current, PAYMENT_ATTEMPT_STATUS.FAILED);
  return Object.freeze({
    ...current,
    status: PAYMENT_ATTEMPT_STATUS.FAILED,
    failureReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * @param {object} attempt
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function cancelPaymentAttempt(attempt, meta = {}) {
  const current = createPaymentAttempt(attempt);
  assertTransition(current, PAYMENT_ATTEMPT_STATUS.CANCELLED);
  return Object.freeze({
    ...current,
    status: PAYMENT_ATTEMPT_STATUS.CANCELLED,
    cancellationReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * @param {object} attempt
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function expirePaymentAttempt(attempt, meta = {}) {
  const current = createPaymentAttempt(attempt);
  assertTransition(current, PAYMENT_ATTEMPT_STATUS.EXPIRED);
  return Object.freeze({
    ...current,
    status: PAYMENT_ATTEMPT_STATUS.EXPIRED,
    expirationReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * Assert provider transaction reference immutability.
 *
 * @param {object} attempt
 * @param {string|null|undefined} nextRef
 */
export function assertProviderTransactionReferenceImmutable(attempt, nextRef) {
  const current = createPaymentAttempt(attempt);
  if (!current.providerTransactionReference) return;
  if (nextRef == null || nextRef === "") return;
  if (String(nextRef).trim() !== current.providerTransactionReference) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
      "providerTransactionReference is immutable once set.",
      { attemptId: current.attemptId }
    );
  }
}
