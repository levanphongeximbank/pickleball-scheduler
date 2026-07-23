/**
 * Financial Obligation lifecycle (Phase 1B).
 *
 * States:
 * - CREATED  → initial creation (not yet due)
 * - OPEN     → due / collectible
 * - PARTIALLY_SETTLED → some settlement applied
 * - SETTLED  → fully settled (terminal)
 * - CANCELLED → cancelled before/without full settlement (terminal)
 * - EXPIRED  → expired without full settlement (terminal)
 *
 * Transitions:
 * CREATED → OPEN | CANCELLED | EXPIRED
 * OPEN → PARTIALLY_SETTLED | SETTLED | CANCELLED | EXPIRED
 * PARTIALLY_SETTLED → PARTIALLY_SETTLED | SETTLED | CANCELLED | EXPIRED
 * SETTLED → (none)
 * CANCELLED → (none)
 * EXPIRED → (none)
 *
 * Amount and currency are immutable once settlement begins (OPEN settlement or PARTIALLY_SETTLED).
 * Overpayment is rejected — never silently accepted.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createMoney, compareMoney, serializeMoney, subtractMoney, addMoney } from "./money.js";

export const OBLIGATION_STATUS = Object.freeze({
  CREATED: "CREATED",
  OPEN: "OPEN",
  PARTIALLY_SETTLED: "PARTIALLY_SETTLED",
  SETTLED: "SETTLED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
});

export const OBLIGATION_STATUS_VALUES = Object.freeze(Object.values(OBLIGATION_STATUS));

export const OBLIGATION_TERMINAL_STATUSES = Object.freeze([
  OBLIGATION_STATUS.SETTLED,
  OBLIGATION_STATUS.CANCELLED,
  OBLIGATION_STATUS.EXPIRED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const OBLIGATION_ALLOWED_TRANSITIONS = Object.freeze({
  [OBLIGATION_STATUS.CREATED]: Object.freeze([
    OBLIGATION_STATUS.OPEN,
    OBLIGATION_STATUS.CANCELLED,
    OBLIGATION_STATUS.EXPIRED,
  ]),
  [OBLIGATION_STATUS.OPEN]: Object.freeze([
    OBLIGATION_STATUS.PARTIALLY_SETTLED,
    OBLIGATION_STATUS.SETTLED,
    OBLIGATION_STATUS.CANCELLED,
    OBLIGATION_STATUS.EXPIRED,
  ]),
  [OBLIGATION_STATUS.PARTIALLY_SETTLED]: Object.freeze([
    OBLIGATION_STATUS.PARTIALLY_SETTLED,
    OBLIGATION_STATUS.SETTLED,
    OBLIGATION_STATUS.CANCELLED,
    OBLIGATION_STATUS.EXPIRED,
  ]),
  [OBLIGATION_STATUS.SETTLED]: Object.freeze([]),
  [OBLIGATION_STATUS.CANCELLED]: Object.freeze([]),
  [OBLIGATION_STATUS.EXPIRED]: Object.freeze([]),
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
 * @param {object} obligation
 * @param {string} nextStatus
 */
function assertTransition(obligation, nextStatus) {
  const allowed = OBLIGATION_ALLOWED_TRANSITIONS[obligation.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid obligation transition ${obligation.status} → ${nextStatus}.`,
      {
        obligationId: obligation.obligationId,
        from: obligation.status,
        to: nextStatus,
      }
    );
  }
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createObligation(input = {}) {
  const obligationId = requireId(input.obligationId ?? input.id, "obligationId");
  const tenantId = requireId(input.tenantId, "tenantId");
  const amount = createMoney(input.amountMinor ?? input.amount?.amountMinor, input.currency ?? input.amount?.currency);
  const settled = createMoney(
    input.settledAmountMinor ?? input.settledAmount?.amountMinor ?? 0,
    amount.currency
  );

  if (compareMoney(settled, amount) > 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.OVERPAYMENT,
      "Settled amount cannot exceed obligation amount.",
      { obligationId }
    );
  }

  const status =
    input.status == null ? OBLIGATION_STATUS.CREATED : String(input.status).trim();
  if (!OBLIGATION_STATUS_VALUES.includes(status)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Invalid obligation status: ${status}.`,
      { field: "status" }
    );
  }

  return Object.freeze({
    obligationId,
    tenantId,
    venueId: optionalId(input.venueId),
    clubId: optionalId(input.clubId),
    subjectRef: optionalId(input.subjectRef),
    feeId: optionalId(input.feeId),
    invoiceId: optionalId(input.invoiceId),
    competitionRef: optionalId(input.competitionRef),
    bookingRef: optionalId(input.bookingRef),
    currency: amount.currency,
    amount: serializeMoney(amount),
    settledAmount: serializeMoney(settled),
    status,
    dueAt: optionalId(input.dueAt),
    createdAt: optionalId(input.createdAt),
    updatedAt: optionalId(input.updatedAt),
    settlementStarted: Boolean(
      input.settlementStarted ||
        status === OBLIGATION_STATUS.PARTIALLY_SETTLED ||
        status === OBLIGATION_STATUS.SETTLED ||
        settled.amountMinor > 0
    ),
  });
}

/**
 * @param {object} obligation
 * @returns {Readonly<object>}
 */
export function openObligation(obligation) {
  const current = createObligation(obligation);
  assertTransition(current, OBLIGATION_STATUS.OPEN);
  return Object.freeze({
    ...current,
    status: OBLIGATION_STATUS.OPEN,
  });
}

/**
 * Apply a settlement amount. Rejects overpayment. Amount/currency immutable once settlement begins.
 *
 * @param {object} obligation
 * @param {{ amountMinor: number, currency?: string }} settlement
 * @returns {Readonly<object>}
 */
export function applyObligationSettlement(obligation, settlement = {}) {
  const current = createObligation(obligation);

  if (OBLIGATION_TERMINAL_STATUSES.includes(current.status)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      `Cannot settle obligation in terminal status ${current.status}.`,
      { obligationId: current.obligationId, status: current.status }
    );
  }

  if (current.status === OBLIGATION_STATUS.CREATED) {
    assertTransition(current, OBLIGATION_STATUS.OPEN);
  }

  const payment = createMoney(
    settlement.amountMinor,
    settlement.currency ?? current.currency
  );
  if (payment.currency !== current.currency) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
      "Settlement currency must match obligation currency.",
      {
        obligationId: current.obligationId,
        expected: current.currency,
        received: payment.currency,
      }
    );
  }
  if (payment.amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Settlement amount must be positive.",
      { obligationId: current.obligationId }
    );
  }

  if (current.settlementStarted) {
    if (
      settlement.currency != null &&
      settlement.currency !== current.currency
    ) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Obligation currency cannot change after settlement begins.",
        { obligationId: current.obligationId }
      );
    }
  }

  const remaining = subtractMoney(current.amount, current.settledAmount);
  if (compareMoney(payment, remaining) > 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.OVERPAYMENT,
      "Settlement would overpay the obligation.",
      {
        obligationId: current.obligationId,
        remainingMinor: remaining.amountMinor,
        attemptedMinor: payment.amountMinor,
      }
    );
  }

  const newSettled = addMoney(current.settledAmount, payment);
  const fullySettled = compareMoney(newSettled, current.amount) === 0;
  const nextStatus = fullySettled
    ? OBLIGATION_STATUS.SETTLED
    : OBLIGATION_STATUS.PARTIALLY_SETTLED;

  if (current.status === OBLIGATION_STATUS.CREATED) {
    // CREATED cannot go directly to PARTIALLY_SETTLED/SETTLED in the transition map;
    // open first conceptually, then settle.
  }
  if (current.status === OBLIGATION_STATUS.OPEN || current.status === OBLIGATION_STATUS.CREATED) {
    assertTransition(
      current.status === OBLIGATION_STATUS.CREATED
        ? { ...current, status: OBLIGATION_STATUS.OPEN }
        : current,
      nextStatus
    );
  } else {
    assertTransition(current, nextStatus);
  }

  return Object.freeze({
    ...current,
    settledAmount: serializeMoney(newSettled),
    status: nextStatus,
    settlementStarted: true,
  });
}

/**
 * @param {object} obligation
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function cancelObligation(obligation, meta = {}) {
  const current = createObligation(obligation);
  assertTransition(current, OBLIGATION_STATUS.CANCELLED);
  return Object.freeze({
    ...current,
    status: OBLIGATION_STATUS.CANCELLED,
    cancellationReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * @param {object} obligation
 * @param {{ reason?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function expireObligation(obligation, meta = {}) {
  const current = createObligation(obligation);
  assertTransition(current, OBLIGATION_STATUS.EXPIRED);
  return Object.freeze({
    ...current,
    status: OBLIGATION_STATUS.EXPIRED,
    expirationReason:
      meta.reason == null || meta.reason === ""
        ? null
        : String(meta.reason).trim(),
  });
}

/**
 * Reject silent amount mutation after settlement begins.
 *
 * @param {object} obligation
 * @param {{ amountMinor: number, currency: string }} nextAmount
 */
export function assertObligationAmountImmutable(obligation, nextAmount) {
  const current = createObligation(obligation);
  if (!current.settlementStarted && current.status === OBLIGATION_STATUS.CREATED) {
    return;
  }
  if (current.settlementStarted || current.status !== OBLIGATION_STATUS.CREATED) {
    const candidate = createMoney(nextAmount.amountMinor, nextAmount.currency);
    if (
      candidate.currency !== current.currency ||
      candidate.amountMinor !== current.amount.amountMinor
    ) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Obligation amount and currency cannot change after settlement begins or once opened.",
        { obligationId: current.obligationId }
      );
    }
  }
}
