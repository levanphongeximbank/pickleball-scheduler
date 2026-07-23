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
  CONFIRM_PAYMENT: "CONFIRM_PAYMENT",
  FAIL_PAYMENT_ATTEMPT: "FAIL_PAYMENT_ATTEMPT",
  CANCEL_PAYMENT_ATTEMPT: "CANCEL_PAYMENT_ATTEMPT",
  EXPIRE_PAYMENT_ATTEMPT: "EXPIRE_PAYMENT_ATTEMPT",
  FAIL_PAYMENT: "FAIL_PAYMENT",
  CANCEL_PAYMENT: "CANCEL_PAYMENT",
  EXPIRE_PAYMENT: "EXPIRE_PAYMENT",
});

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
  const obligationService = deps.obligationService;
  const invoiceService = deps.invoiceService;
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

          if (invoiceId) {
            invoice = invoiceRepository.getById(ctx.tenantId, invoiceId);
            amountMinor = amountMinor ?? invoice.total.amountMinor;
            currency = currency ?? invoice.currency;
          }
          if (obligationId) {
            obligation = obligationRepository.getById(
              ctx.tenantId,
              obligationId
            );
            amountMinor = amountMinor ?? obligation.amount.amountMinor;
            currency = currency ?? obligation.currency;
          }
          if (amountMinor == null || currency == null) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_INPUT,
              "initiatePayment requires amount/currency or invoice/obligation reference."
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
          if (current.status === PAYMENT_STATUS.FAILED) {
            // Domain allows adding attempts only when not cancelled/expired/confirmed.
            // For FAILED payment at payment-level, reopen conceptually via addPaymentAttempt
            // which sets status back to PENDING.
          }
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

          if (!confirmation.financialEffectApplied) {
            return Object.freeze({
              payment: confirmation.payment,
              eventIds: [],
              financialEffectApplied: false,
            });
          }

          const confirmed = confirmation.payment;
          const attempt = confirmed.attempts.find((a) => a.attemptId === attemptId);
          paymentAttemptRepository.update(ctx.tenantId, attemptId, attempt);
          const savedPayment = paymentRepository.update(
            ctx.tenantId,
            paymentId,
            {
              ...confirmed,
              updatedAt: ctx.occurredAt,
            }
          );

          // Settle obligation / invoice once.
          if (savedPayment.obligationId && obligationService) {
            obligationService.applySettlementFromConfirmedPayment({
              tenantId: ctx.tenantId,
              obligationId: savedPayment.obligationId,
              amountMinor: savedPayment.amount.amountMinor,
              currency: savedPayment.currency,
              occurredAt: ctx.occurredAt,
            });
          }
          if (savedPayment.invoiceId && invoiceService) {
            invoiceService.applyPaymentHintFromConfirmedPayment({
              tenantId: ctx.tenantId,
              invoiceId: savedPayment.invoiceId,
              amountMinor: savedPayment.amount.amountMinor,
              currency: savedPayment.currency,
              occurredAt: ctx.occurredAt,
            });
          }

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
            },
          });

          return Object.freeze({
            payment: savedPayment,
            eventIds: [event.eventId],
            financialEffectApplied: true,
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
