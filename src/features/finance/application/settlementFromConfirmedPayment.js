/**
 * Internal settlement helpers for confirmed payments (Phase 1L / F-01 / F-02).
 *
 * Not a public business command surface. Callers must supply a payment that is
 * already CONFIRMED and loaded under the command tenant. These helpers exist
 * only so PaymentApplicationService can apply / reconcile settlement effects.
 */

import { applyObligationSettlement } from "../domain/obligation.js";
import {
  applyInvoicePaymentHint,
  assertIssuedInvoiceImmutable,
} from "../domain/invoice.js";
import { PAYMENT_STATUS } from "../domain/payment.js";
import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { requireCommandId } from "./commandSupport.js";

/**
 * Sealed brand — cannot be forged by plain external command objects.
 * @type {unique symbol}
 */
export const CONFIRMED_PAYMENT_SETTLEMENT_BRAND = Symbol(
  "finance.confirmedPaymentSettlement"
);

/**
 * @param {object} payment — tenant-scoped confirmed payment already loaded
 * @returns {Readonly<object>}
 */
export function createConfirmedPaymentSettlementContext(payment) {
  if (!payment || typeof payment !== "object") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Confirmed payment settlement requires a payment entity."
    );
  }
  if (payment.status !== PAYMENT_STATUS.CONFIRMED) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_TRANSITION,
      "Settlement helpers require a confirmed payment.",
      { paymentId: payment.paymentId, status: payment.status }
    );
  }
  return Object.freeze({
    [CONFIRMED_PAYMENT_SETTLEMENT_BRAND]: true,
    payment,
    tenantId: payment.tenantId,
    paymentId: payment.paymentId,
    amountMinor: payment.amount.amountMinor,
    currency: payment.currency,
    obligationId: payment.obligationId,
    invoiceId: payment.invoiceId,
  });
}

/**
 * @param {unknown} context
 * @returns {boolean}
 */
export function isConfirmedPaymentSettlementContext(context) {
  return Boolean(
    context &&
      typeof context === "object" &&
      context[CONFIRMED_PAYMENT_SETTLEMENT_BRAND] === true &&
      context.payment &&
      context.payment.status === PAYMENT_STATUS.CONFIRMED
  );
}

/**
 * @param {object} deps
 * @param {object} context — from createConfirmedPaymentSettlementContext
 * @param {{ occurredAt?: string }} [meta]
 * @returns {{ obligation: object|null, invoice: object|null }}
 */
export function applySettlementEffectsFromConfirmedPayment(deps, context, meta = {}) {
  if (!isConfirmedPaymentSettlementContext(context)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Settlement requires a validated confirmed-payment context.",
      { field: "settlementContext" }
    );
  }

  const obligationRepository = deps.obligationRepository;
  const invoiceRepository = deps.invoiceRepository;
  const tenantId = requireCommandId(context.tenantId, "tenantId");
  let obligation = null;
  let invoice = null;

  if (context.obligationId) {
    if (!obligationRepository) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "obligationRepository is required to settle an obligation."
      );
    }
    const current = obligationRepository.getById(tenantId, context.obligationId);
    const next = applyObligationSettlement(current, {
      amountMinor: context.amountMinor,
      currency: context.currency,
    });
    obligation = obligationRepository.update(tenantId, context.obligationId, {
      ...next,
      updatedAt: meta.occurredAt || current.updatedAt,
    });
  }

  if (context.invoiceId) {
    if (!invoiceRepository) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "invoiceRepository is required to settle an invoice."
      );
    }
    const current = invoiceRepository.getById(tenantId, context.invoiceId);
    assertIssuedInvoiceImmutable(current, current);
    const next = applyInvoicePaymentHint(current, {
      amountMinor: context.amountMinor,
      currency: context.currency,
    });
    invoice = invoiceRepository.update(tenantId, context.invoiceId, {
      ...next,
      updatedAt: meta.occurredAt || current.updatedAt,
    });
  }

  return Object.freeze({ obligation, invoice });
}
