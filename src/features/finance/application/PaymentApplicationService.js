/**
 * PaymentApplicationService — initiate, attempt, confirm/fail/cancel/expire,
 * settle referenced obligation/invoice, idempotent replay.
 */

import {
  createPayment,
  addPaymentAttempt,
  confirmPayment,
  failPayment,
  cancelPayment,
  expirePayment,
  PAYMENT_STATUS,
} from "../domain/payment.js";
import {
  failPaymentAttempt,
  cancelPaymentAttempt,
  expirePaymentAttempt,
  PAYMENT_ATTEMPT_STATUS,
} from "../domain/paymentAttempt.js";
import { applyObligationSettlement } from "../domain/obligation.js";
import {
  applyInvoicePaymentHint,
  assertIssuedInvoiceImmutable,
} from "../domain/invoice.js";
import { FINANCE_EVENT_TYPE } from "../events/catalogue.js";
import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { executeIdempotent } from "./idempotentExecution.js";
import {
  optionalCommandId,
  requireCommandContext,
  requireCommandId,
  requireIdGenerator,
} from "./commandSupport.js";

export const PAYMENT_OPERATIONS = Object.freeze({
  INITIATE_PAYMENT: "INITIATE_PAYMENT",
  CREATE_PAYMENT_ATTEMPT: "CREATE_PAYMENT_ATTEMPT",
  CREATE_PAYMENT_ATTEMPT_WITH_PROVIDER: "CREATE_PAYMENT_ATTEMPT_WITH_PROVIDER",
  CONFIRM_PAYMENT: "CONFIRM_PAYMENT",
  VERIFY_AND_CONFIRM_PAYMENT: "VERIFY_AND_CONFIRM_PAYMENT",
  FAIL_PAYMENT_ATTEMPT: "FAIL_PAYMENT_ATTEMPT",
  CANCEL_PAYMENT_ATTEMPT: "CANCEL_PAYMENT_ATTEMPT",
  EXPIRE_PAYMENT_ATTEMPT: "EXPIRE_PAYMENT_ATTEMPT",
  FAIL_PAYMENT: "FAIL_PAYMENT",
  CANCEL_PAYMENT: "CANCEL_PAYMENT",
  EXPIRE_PAYMENT: "EXPIRE_PAYMENT",
});

/**
 * Outstanding remaining amount for an obligation or invoice.
 * @param {{ amountMinor: number } | null} total
 * @param {{ amountMinor: number } | null} paidOrSettled
 * @param {string} label
 * @returns {number}
 */
function requireRemainingPayableMinor(total, paidOrSettled, label) {
  if (!total || typeof total.amountMinor !== "number") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${label} amount is required to compute remaining payable.`
    );
  }
  const paid =
    paidOrSettled && typeof paidOrSettled.amountMinor === "number"
      ? paidOrSettled.amountMinor
      : 0;
  if (!Number.isSafeInteger(paid) || paid < 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      `${label} settled/paid amount is inconsistent.`,
      { field: label }
    );
  }
  const remaining = total.amountMinor - paid;
  if (!Number.isSafeInteger(remaining) || remaining < 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      `${label} remaining amount is inconsistent.`,
      { remainingMinor: remaining }
    );
  }
  return remaining;
}

/**
 * @param {object} deps
 */
export function createPaymentApplicationService(deps = {}) {
  const paymentRepository = deps.paymentRepository;
  const paymentAttemptRepository = deps.paymentAttemptRepository;
  const invoiceRepository = deps.invoiceRepository;
  const obligationRepository = deps.obligationRepository;
  const idempotencyRepository = deps.idempotencyRepository;
  const eventRecorder = deps.eventRecorder;
  const paymentProvider = deps.paymentProvider || null;
  const idGenerator = requireIdGenerator(deps);

  if (!paymentRepository || !paymentAttemptRepository || !eventRecorder) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "paymentRepository, paymentAttemptRepository, and eventRecorder are required."
    );
  }

  function assertCurrencyMatchesTarget(payment, invoice, obligation) {
    if (invoice && payment.currency !== invoice.currency) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
        "Payment currency must match invoice currency.",
        { paymentId: payment.paymentId, invoiceId: invoice.invoiceId }
      );
    }
    if (obligation && payment.currency !== obligation.currency) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
        "Payment currency must match obligation currency.",
        { paymentId: payment.paymentId, obligationId: obligation.obligationId }
      );
    }
  }

  /**
   * Apply missing obligation/invoice settlement for a confirmed payment.
   * Idempotent via per-target settlement flags — does not recontact provider.
   * Foundation does not claim multi-record DB atomicity.
   *
   * @param {object} payment
   * @param {object} ctx
   * @returns {{ payment: object, settlementAppliedNow: boolean }}
   */
  function ensureSettlementFromConfirmedPayment(payment, ctx) {
    if (payment.status !== PAYMENT_STATUS.CONFIRMED) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_TRANSITION,
        "Settlement reconciliation requires a confirmed payment.",
        { paymentId: payment.paymentId, status: payment.status }
      );
    }
    if (payment.settlementEffectApplied) {
      return { payment, settlementAppliedNow: false };
    }

    let current = payment;
    let settlementAppliedNow = false;

    if (current.obligationId && !current.obligationSettlementApplied) {
      if (!obligationRepository) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "obligationRepository is required to settle an obligation."
        );
      }
      const obligation = obligationRepository.getById(
        ctx.tenantId,
        current.obligationId
      );
      const nextObligation = applyObligationSettlement(obligation, {
        amountMinor: current.amount.amountMinor,
        currency: current.currency,
      });
      obligationRepository.update(ctx.tenantId, current.obligationId, {
        ...nextObligation,
        updatedAt: ctx.occurredAt,
      });
      current = paymentRepository.update(ctx.tenantId, current.paymentId, {
        ...current,
        obligationSettlementApplied: true,
        updatedAt: ctx.occurredAt,
      });
      settlementAppliedNow = true;
    }

    if (current.invoiceId && !current.invoiceSettlementApplied) {
      if (!invoiceRepository) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "invoiceRepository is required to settle an invoice."
        );
      }
      const invoice = invoiceRepository.getById(ctx.tenantId, current.invoiceId);
      assertIssuedInvoiceImmutable(invoice, invoice);
      const nextInvoice = applyInvoicePaymentHint(invoice, {
        amountMinor: current.amount.amountMinor,
        currency: current.currency,
      });
      invoiceRepository.update(ctx.tenantId, current.invoiceId, {
        ...nextInvoice,
        updatedAt: ctx.occurredAt,
      });
      current = paymentRepository.update(ctx.tenantId, current.paymentId, {
        ...current,
        invoiceSettlementApplied: true,
        updatedAt: ctx.occurredAt,
      });
      settlementAppliedNow = true;
    }

    current = paymentRepository.update(ctx.tenantId, current.paymentId, {
      ...current,
      settlementEffectApplied: true,
      obligationSettlementApplied:
        !current.obligationId || Boolean(current.obligationSettlementApplied),
      invoiceSettlementApplied:
        !current.invoiceId || Boolean(current.invoiceSettlementApplied),
      updatedAt: ctx.occurredAt,
    });

    return { payment: current, settlementAppliedNow };
  }

  function terminalAttempt(command, operationType, transitionFn, eventType, label) {
    const ctx = requireCommandContext(command);
    const paymentId = requireCommandId(command.paymentId, "paymentId");
    const attemptId = requireCommandId(command.attemptId, "attemptId");
    return executeIdempotent(
      { idempotencyRepository },
      operationType,
      command,
      { paymentId, attemptId, reason: command.reason ?? null },
      () => {
        const payment = paymentRepository.getById(ctx.tenantId, paymentId);
        const attempt = paymentAttemptRepository.getById(
          ctx.tenantId,
          attemptId
        );
        if (attempt.paymentId !== paymentId) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.INVALID_REFERENCE,
            "Attempt does not belong to payment.",
            { paymentId, attemptId }
          );
        }
        if (attempt.status !== PAYMENT_ATTEMPT_STATUS.PENDING) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.INVALID_TRANSITION,
            `Cannot mark ${label} attempt that is already ${attempt.status}.`,
            { attemptId, status: attempt.status }
          );
        }
        const nextAttempt = transitionFn(attempt, { reason: command.reason });
        paymentAttemptRepository.update(ctx.tenantId, attemptId, {
          ...nextAttempt,
          updatedAt: ctx.occurredAt,
        });
        const nextAttempts = payment.attempts.map((a) =>
          a.attemptId === attemptId ? nextAttempt : a
        );
        const savedPayment = paymentRepository.update(ctx.tenantId, paymentId, {
          ...payment,
          attempts: nextAttempts,
          updatedAt: ctx.occurredAt,
        });
        const event = eventRecorder.record({
          eventType,
          occurredAt: ctx.occurredAt,
          tenantId: ctx.tenantId,
          venueId: savedPayment.venueId,
          clubId: savedPayment.clubId,
          correlationId: ctx.correlationId,
          causationId: ctx.causationId,
          eventIdempotencyKey: `evt:${ctx.tenantId}:payment-${label}-attempt:${ctx.idempotencyKey}`,
          actor: ctx.actor,
          financialReferences: { paymentId, attemptId },
          amountMinor: savedPayment.amount.amountMinor,
          currency: savedPayment.currency,
          reason: command.reason ?? null,
          payload: {
            paymentId,
            attemptId,
            attemptStatus: nextAttempt.status,
            paymentStatus: savedPayment.status,
          },
        });
        return Object.freeze({
          payment: savedPayment,
          attempt: nextAttempt,
          eventIds: [event.eventId],
          financialEffectApplied: true,
        });
      }
    );
  }

  function terminalPayment(command, operationType, transitionFn, eventType) {
    const ctx = requireCommandContext(command);
    const paymentId = requireCommandId(command.paymentId, "paymentId");
    return executeIdempotent(
      { idempotencyRepository },
      operationType,
      command,
      { paymentId, reason: command.reason ?? null },
      () => {
        const current = paymentRepository.getById(ctx.tenantId, paymentId);
        const next = transitionFn(current, { reason: command.reason });
        const saved = paymentRepository.update(ctx.tenantId, paymentId, {
          ...next,
          updatedAt: ctx.occurredAt,
        });
        const event = eventRecorder.record({
          eventType,
          occurredAt: ctx.occurredAt,
          tenantId: ctx.tenantId,
          venueId: saved.venueId,
          clubId: saved.clubId,
          correlationId: ctx.correlationId,
          causationId: ctx.causationId,
          eventIdempotencyKey: `evt:${ctx.tenantId}:${operationType}:${ctx.idempotencyKey}`,
          actor: ctx.actor,
          financialReferences: { paymentId: saved.paymentId },
          amountMinor: saved.amount.amountMinor,
          currency: saved.currency,
          reason: command.reason ?? null,
          payload: { paymentId: saved.paymentId, status: saved.status },
        });
        return Object.freeze({
          payment: saved,
          eventIds: [event.eventId],
          financialEffectApplied: true,
        });
      }
    );
  }

  return {
    initiatePayment(command = {}) {
      const ctx = requireCommandContext(command);
      const paymentId =
        optionalCommandId(command.paymentId, "paymentId") ||
        idGenerator("payment");
      const invoiceId = optionalCommandId(command.invoiceId, "invoiceId");
      const obligationId = optionalCommandId(
        command.obligationId,
        "obligationId"
      );

      return executeIdempotent(
        { idempotencyRepository },
        PAYMENT_OPERATIONS.INITIATE_PAYMENT,
        command,
        {
          paymentId,
          invoiceId,
          obligationId,
          amountMinor: command.amountMinor,
          currency: command.currency,
          providerReference: command.providerReference ?? null,
        },
        () => {
          let amountMinor = command.amountMinor;
          let currency = command.currency;
          let invoice = null;
          let obligation = null;
          /** @type {number|null} */
          let remainingPayable = null;

          if (invoiceId) {
            if (!invoiceRepository) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.INVALID_INPUT,
                "invoiceRepository is required when invoiceId is provided."
              );
            }
            invoice = invoiceRepository.getById(ctx.tenantId, invoiceId);
            currency = currency ?? invoice.currency;
            remainingPayable = requireRemainingPayableMinor(
              invoice.total,
              invoice.amountPaid,
              "invoice"
            );
            if (remainingPayable === 0) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.INVALID_INPUT,
                "Cannot initiate payment against a fully settled invoice.",
                { invoiceId, remainingMinor: 0 }
              );
            }
            amountMinor = amountMinor ?? remainingPayable;
          }
          if (obligationId) {
            if (!obligationRepository) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.INVALID_INPUT,
                "obligationRepository is required when obligationId is provided."
              );
            }
            obligation = obligationRepository.getById(
              ctx.tenantId,
              obligationId
            );
            currency = currency ?? obligation.currency;
            const obligationRemaining = requireRemainingPayableMinor(
              obligation.amount,
              obligation.settledAmount,
              "obligation"
            );
            if (obligationRemaining === 0) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.INVALID_INPUT,
                "Cannot initiate payment against a fully settled obligation.",
                { obligationId, remainingMinor: 0 }
              );
            }
            if (remainingPayable == null) {
              remainingPayable = obligationRemaining;
              amountMinor = amountMinor ?? obligationRemaining;
            } else {
              remainingPayable = Math.min(remainingPayable, obligationRemaining);
              amountMinor = amountMinor ?? remainingPayable;
            }
          }
          if (amountMinor == null || currency == null) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_INPUT,
              "initiatePayment requires amount/currency or invoice/obligation reference."
            );
          }
          if (
            typeof amountMinor !== "number" ||
            !Number.isSafeInteger(amountMinor) ||
            amountMinor <= 0
          ) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_MONEY,
              "Payment initiation amount must be a positive safe integer.",
              { amountMinor }
            );
          }
          if (remainingPayable != null && amountMinor > remainingPayable) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.OVERPAYMENT,
              "Initiated payment cannot exceed remaining payable amount.",
              {
                attemptedMinor: amountMinor,
                remainingMinor: remainingPayable,
                invoiceId,
                obligationId,
              }
            );
          }

          const payment = createPayment({
            paymentId,
            tenantId: ctx.tenantId,
            venueId: command.venueId,
            clubId: command.clubId,
            invoiceId,
            obligationId,
            amountMinor,
            currency,
            providerReference: command.providerReference,
            idempotencyKey: ctx.idempotencyKey,
            createdAt: ctx.occurredAt,
            updatedAt: ctx.occurredAt,
            settlementEffectApplied: false,
            obligationSettlementApplied: false,
            invoiceSettlementApplied: false,
          });
          assertCurrencyMatchesTarget(payment, invoice, obligation);
          const saved = paymentRepository.save(payment);
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.PAYMENT_PENDING,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:payment-pending:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              paymentId: saved.paymentId,
              invoiceId: saved.invoiceId,
              obligationId: saved.obligationId,
            },
            amountMinor: saved.amount.amountMinor,
            currency: saved.currency,
            payload: { paymentId: saved.paymentId, status: saved.status },
          });
          return Object.freeze({
            payment: saved,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    createPaymentAttempt(command = {}) {
      const ctx = requireCommandContext(command);
      const paymentId = requireCommandId(command.paymentId, "paymentId");
      const attemptId =
        optionalCommandId(command.attemptId, "attemptId") ||
        idGenerator("attempt");

      return executeIdempotent(
        { idempotencyRepository },
        PAYMENT_OPERATIONS.CREATE_PAYMENT_ATTEMPT,
        command,
        {
          paymentId,
          attemptId,
          providerReference: command.providerReference ?? null,
        },
        () => {
          const current = paymentRepository.getById(ctx.tenantId, paymentId);
          const withAttempt = addPaymentAttempt(current, {
            attemptId,
            providerReference: command.providerReference,
            createdAt: ctx.occurredAt,
            updatedAt: ctx.occurredAt,
            idempotencyKey: ctx.idempotencyKey,
          });
          const attempt = withAttempt.attempts[withAttempt.attempts.length - 1];
          paymentAttemptRepository.save(attempt);
          const savedPayment = paymentRepository.update(
            ctx.tenantId,
            paymentId,
            {
              ...withAttempt,
              updatedAt: ctx.occurredAt,
            }
          );
          return Object.freeze({
            payment: savedPayment,
            attempt,
            eventIds: [],
            financialEffectApplied: true,
          });
        }
      );
    },

    /**
     * Create a payment attempt and initiate via injected PaymentProviderPort.
     * Does NOT confirm payment — verification is required separately.
     */
    createPaymentAttemptWithProvider(command = {}) {
      if (!paymentProvider) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "paymentProvider is required for createPaymentAttemptWithProvider."
        );
      }
      const ctx = requireCommandContext(command);
      const paymentId = requireCommandId(command.paymentId, "paymentId");
      const attemptId =
        optionalCommandId(command.attemptId, "attemptId") ||
        idGenerator("attempt");
      const providerCode = requireCommandId(command.providerCode, "providerCode");

      return executeIdempotent(
        { idempotencyRepository },
        PAYMENT_OPERATIONS.CREATE_PAYMENT_ATTEMPT_WITH_PROVIDER,
        command,
        {
          paymentId,
          attemptId,
          providerCode,
          description: command.description ?? null,
          returnReference: command.returnReference ?? null,
          expiresAt: command.expiresAt ?? null,
          metadata: command.metadata ?? null,
        },
        () => {
          const current = paymentRepository.getById(ctx.tenantId, paymentId);
          const withAttempt = addPaymentAttempt(current, {
            attemptId,
            createdAt: ctx.occurredAt,
            updatedAt: ctx.occurredAt,
            idempotencyKey: ctx.idempotencyKey,
          });
          const attempt = withAttempt.attempts[withAttempt.attempts.length - 1];

          const initiation = paymentProvider.initiatePayment(
            {
              tenantId: ctx.tenantId,
              operationId: attemptId,
              idempotencyKey: ctx.idempotencyKey,
              correlationId: ctx.correlationId,
              causationId: ctx.causationId,
              providerCode,
              paymentId,
              occurredAt: ctx.occurredAt,
            },
            {
              tenantId: ctx.tenantId,
              paymentId,
              paymentAttemptId: attemptId,
              amountMinor: current.amount.amountMinor,
              currency: current.currency,
              idempotencyKey: ctx.idempotencyKey,
              correlationId: ctx.correlationId,
              description: command.description,
              returnReference: command.returnReference,
              expiresAt: command.expiresAt,
              metadata: command.metadata,
            }
          );

          const enrichedAttempt = {
            ...attempt,
            providerReference: initiation.providerPaymentReference,
            providerTransactionReference: null,
            evidenceRef: initiation.evidence?.evidenceRef || null,
          };
          paymentAttemptRepository.save(enrichedAttempt);
          const nextAttempts = withAttempt.attempts.map((a) =>
            a.attemptId === attemptId ? enrichedAttempt : a
          );
          const savedPayment = paymentRepository.update(ctx.tenantId, paymentId, {
            ...withAttempt,
            attempts: nextAttempts,
            providerReference: initiation.providerPaymentReference,
            updatedAt: ctx.occurredAt,
          });

          return Object.freeze({
            payment: savedPayment,
            attempt: enrichedAttempt,
            providerResult: initiation,
            eventIds: [],
            financialEffectApplied: true,
          });
        }
      );
    },

    /**
     * Verify provider evidence, then apply Finance confirmation rules.
     * Client-declared success alone is insufficient.
     */
    verifyAndConfirmPayment(command = {}) {
      if (!paymentProvider) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "paymentProvider is required for verifyAndConfirmPayment."
        );
      }
      const ctx = requireCommandContext(command);
      const paymentId = requireCommandId(command.paymentId, "paymentId");
      const attemptId = requireCommandId(command.attemptId, "attemptId");
      const providerCode = requireCommandId(command.providerCode, "providerCode");
      const providerPaymentReference = requireCommandId(
        command.providerPaymentReference,
        "providerPaymentReference"
      );

      return executeIdempotent(
        { idempotencyRepository },
        PAYMENT_OPERATIONS.VERIFY_AND_CONFIRM_PAYMENT,
        command,
        {
          paymentId,
          attemptId,
          providerCode,
          providerPaymentReference,
          evidenceRef: command.evidenceRef ?? null,
          providerTransactionReference:
            command.providerTransactionReference ?? null,
          clientDeclaredSuccess: Boolean(command.clientDeclaredSuccess),
          amountMinor: command.amountMinor ?? null,
          currency: command.currency ?? null,
        },
        () => {
          const current = paymentRepository.getById(ctx.tenantId, paymentId);
          const verification = paymentProvider.verifyPaymentConfirmation(
            {
              tenantId: ctx.tenantId,
              operationId: `verify-${attemptId}`,
              idempotencyKey: ctx.idempotencyKey,
              correlationId: ctx.correlationId,
              causationId: ctx.causationId,
              providerCode,
              paymentId,
              occurredAt: ctx.occurredAt,
            },
            {
              evidenceRef: command.evidenceRef,
              providerPaymentReference,
              providerTransactionReference: command.providerTransactionReference,
              paymentId,
              amountMinor: command.amountMinor ?? current.amount.amountMinor,
              currency: command.currency ?? current.currency,
              clientDeclaredSuccess: command.clientDeclaredSuccess,
            }
          );

          if (!verification.verified) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
              verification.failureReason ||
                "Provider verification did not confirm payment.",
              {
                paymentId,
                providerStatus: verification.providerStatus,
                clientDeclaredSuccess: verification.clientDeclaredSuccess,
              }
            );
          }

          const evidenceRef =
            verification.evidence?.evidenceRef ||
            requireCommandId(command.evidenceRef, "evidenceRef");
          const providerTransactionReference =
            verification.providerTransactionReference ||
            providerPaymentReference;

          return this.confirmPayment({
            ...command,
            idempotencyKey: `${ctx.idempotencyKey}::confirm`,
            evidenceRef,
            providerTransactionReference,
            attemptId,
            paymentId,
          });
        }
      );
    },

    confirmPayment(command = {}) {
      const ctx = requireCommandContext(command);
      const paymentId = requireCommandId(command.paymentId, "paymentId");
      const attemptId = requireCommandId(command.attemptId, "attemptId");
      const evidenceRef = requireCommandId(command.evidenceRef, "evidenceRef");
      const providerTransactionReference = optionalCommandId(
        command.providerTransactionReference,
        "providerTransactionReference"
      );

      return executeIdempotent(
        { idempotencyRepository },
        PAYMENT_OPERATIONS.CONFIRM_PAYMENT,
        command,
        {
          paymentId,
          attemptId,
          evidenceRef,
          providerTransactionReference,
          auditEvidenceRef: command.auditEvidenceRef ?? null,
        },
        () => {
          const current = paymentRepository.getById(ctx.tenantId, paymentId);

          if (providerTransactionReference) {
            const owner =
              paymentRepository.findByProviderTransactionReference(
                ctx.tenantId,
                providerTransactionReference
              );
            if (owner && owner.paymentId !== paymentId) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.CONFLICT,
                "providerTransactionReference is already used by another payment in this tenant.",
                {
                  tenantId: ctx.tenantId,
                  providerTransactionReference,
                  existingPaymentId: owner.paymentId,
                }
              );
            }
          }

          const confirmation = confirmPayment(current, {
            attemptId,
            evidenceRef,
            auditEvidenceRef: command.auditEvidenceRef,
            providerTransactionReference,
            confirmedAt: ctx.occurredAt,
          });

          let savedPayment;
          const confirmationAppliedNow = confirmation.financialEffectApplied;

          if (confirmation.financialEffectApplied) {
            const confirmed = {
              ...confirmation.payment,
              settlementEffectApplied: false,
              obligationSettlementApplied: false,
              invoiceSettlementApplied: false,
            };
            const attempt = confirmed.attempts.find(
              (a) => a.attemptId === attemptId
            );
            paymentAttemptRepository.update(ctx.tenantId, attemptId, attempt);
            savedPayment = paymentRepository.update(ctx.tenantId, paymentId, {
              ...confirmed,
              updatedAt: ctx.occurredAt,
            });
          } else {
            // Already confirmed for this attempt — reconcile missing settlement.
            // Never reconfirm or recontact the provider during replay recovery.
            savedPayment = confirmation.payment;
          }

          const settled = ensureSettlementFromConfirmedPayment(
            savedPayment,
            ctx
          );
          savedPayment = settled.payment;

          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: savedPayment.venueId,
            clubId: savedPayment.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:payment-confirmed:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              paymentId: savedPayment.paymentId,
              invoiceId: savedPayment.invoiceId,
              obligationId: savedPayment.obligationId,
            },
            amountMinor: savedPayment.amount.amountMinor,
            currency: savedPayment.currency,
            evidenceRef,
            evidenceReferences: [evidenceRef],
            payload: {
              paymentId: savedPayment.paymentId,
              attemptId,
              status: savedPayment.status,
              settlementEffectApplied: savedPayment.settlementEffectApplied,
            },
          });

          return Object.freeze({
            payment: savedPayment,
            eventIds: [event.eventId],
            financialEffectApplied:
              confirmationAppliedNow || settled.settlementAppliedNow,
            settlementReconciled: settled.settlementAppliedNow,
          });
        }
      );
    },

    failPaymentAttempt(command = {}) {
      return terminalAttempt(
        command,
        PAYMENT_OPERATIONS.FAIL_PAYMENT_ATTEMPT,
        failPaymentAttempt,
        FINANCE_EVENT_TYPE.PAYMENT_FAILED,
        "failed"
      );
    },

    cancelPaymentAttempt(command = {}) {
      return terminalAttempt(
        command,
        PAYMENT_OPERATIONS.CANCEL_PAYMENT_ATTEMPT,
        cancelPaymentAttempt,
        FINANCE_EVENT_TYPE.PAYMENT_CANCELLED,
        "cancelled"
      );
    },

    expirePaymentAttempt(command = {}) {
      return terminalAttempt(
        command,
        PAYMENT_OPERATIONS.EXPIRE_PAYMENT_ATTEMPT,
        expirePaymentAttempt,
        FINANCE_EVENT_TYPE.PAYMENT_EXPIRED,
        "expired"
      );
    },

    failPayment(command = {}) {
      return terminalPayment(
        command,
        PAYMENT_OPERATIONS.FAIL_PAYMENT,
        failPayment,
        FINANCE_EVENT_TYPE.PAYMENT_FAILED
      );
    },

    cancelPayment(command = {}) {
      return terminalPayment(
        command,
        PAYMENT_OPERATIONS.CANCEL_PAYMENT,
        cancelPayment,
        FINANCE_EVENT_TYPE.PAYMENT_CANCELLED
      );
    },

    expirePayment(command = {}) {
      return terminalPayment(
        command,
        PAYMENT_OPERATIONS.EXPIRE_PAYMENT,
        expirePayment,
        FINANCE_EVENT_TYPE.PAYMENT_EXPIRED
      );
    },
  };
}
