/**
 * RefundApplicationService — request / approve / reject / complete with evidence.
 * Supports multiple partial refunds without rewriting original payment amount.
 * In-flight REQUESTED/APPROVED refunds reserve refundable balance (Phase 1L / F-03).
 */

import {
  requestRefund,
  approveRefund,
  rejectRefund,
  completeRefund,
  REFUND_STATUS,
} from "../domain/refund.js";
import { getRefundableAmount } from "../domain/payment.js";
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

export const REFUND_OPERATIONS = Object.freeze({
  REQUEST_REFUND: "REQUEST_REFUND",
  APPROVE_REFUND: "APPROVE_REFUND",
  REJECT_REFUND: "REJECT_REFUND",
  COMPLETE_REFUND: "COMPLETE_REFUND",
  INITIATE_PROVIDER_REFUND: "INITIATE_PROVIDER_REFUND",
  VERIFY_AND_COMPLETE_REFUND: "VERIFY_AND_COMPLETE_REFUND",
});

const RESERVING_REFUND_STATUSES = Object.freeze([
  REFUND_STATUS.REQUESTED,
  REFUND_STATUS.APPROVED,
]);

/**
 * @param {object[]} refunds
 * @param {{ excludeRefundId?: string|null }} [options]
 * @returns {number}
 */
function sumInFlightReservationMinor(refunds, options = {}) {
  let total = 0;
  for (const refund of refunds) {
    if (
      options.excludeRefundId &&
      refund.refundId === options.excludeRefundId
    ) {
      continue;
    }
    if (RESERVING_REFUND_STATUSES.includes(refund.status)) {
      total += refund.amount.amountMinor;
    }
  }
  return total;
}

/**
 * @param {object} deps
 */
export function createRefundApplicationService(deps = {}) {
  const refundRepository = deps.refundRepository;
  const paymentRepository = deps.paymentRepository;
  const idempotencyRepository = deps.idempotencyRepository;
  const eventRecorder = deps.eventRecorder;
  const paymentProvider = deps.paymentProvider || null;
  const idGenerator = requireIdGenerator(deps);

  if (!refundRepository || !paymentRepository || !eventRecorder) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "refundRepository, paymentRepository, and eventRecorder are required."
    );
  }

  function listRefundsForPayment(tenantId, paymentId) {
    if (typeof refundRepository.listByPaymentId !== "function") {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "refundRepository.listByPaymentId is required for refund reservation."
      );
    }
    return refundRepository.listByPaymentId(tenantId, paymentId) || [];
  }

  function remainingRefundableForPayment(tenantId, paymentId, options = {}) {
    const payment = paymentRepository.getById(tenantId, paymentId);
    const reserved = sumInFlightReservationMinor(
      listRefundsForPayment(tenantId, paymentId),
      options
    );
    return getRefundableAmount(payment, { reservedInFlightMinor: reserved });
  }

  return {
    requestRefund(command = {}) {
      const ctx = requireCommandContext(command);
      const paymentId = requireCommandId(command.paymentId, "paymentId");
      const refundId =
        optionalCommandId(command.refundId, "refundId") ||
        idGenerator("refund");

      return executeIdempotent(
        { idempotencyRepository },
        REFUND_OPERATIONS.REQUEST_REFUND,
        command,
        {
          paymentId,
          refundId,
          amountMinor: command.amountMinor,
          currency: command.currency ?? null,
          reason: command.reason ?? null,
        },
        () => {
          const payment = paymentRepository.getById(ctx.tenantId, paymentId);
          const reservedInFlightMinor = sumInFlightReservationMinor(
            listRefundsForPayment(ctx.tenantId, paymentId)
          );
          const { refund } = requestRefund(payment, {
            refundId,
            amountMinor: command.amountMinor,
            currency: command.currency,
            reason: command.reason,
            requestedAt: ctx.occurredAt,
            reservedInFlightMinor,
          });
          const saved = refundRepository.save(refund);
          const remaining = remainingRefundableForPayment(
            ctx.tenantId,
            paymentId
          );
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.REFUND_REQUESTED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:refund-requested:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              refundId: saved.refundId,
              paymentId: saved.paymentId,
            },
            amountMinor: saved.amount.amountMinor,
            currency: saved.currency,
            reason: saved.reason,
            payload: {
              refundId: saved.refundId,
              paymentId: saved.paymentId,
              remainingRefundableMinor: remaining.amountMinor,
            },
          });
          return Object.freeze({
            refund: saved,
            payment,
            remainingRefundable: remaining,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    approveRefund(command = {}) {
      const ctx = requireCommandContext(command);
      const refundId = requireCommandId(command.refundId, "refundId");
      return executeIdempotent(
        { idempotencyRepository },
        REFUND_OPERATIONS.APPROVE_REFUND,
        command,
        { refundId },
        () => {
          const current = refundRepository.getById(ctx.tenantId, refundId);
          // Capacity was reserved at request; re-validate against remaining
          // excluding this refund's own reservation (still REQUESTED).
          const remainingExcludingSelf = remainingRefundableForPayment(
            ctx.tenantId,
            current.paymentId,
            { excludeRefundId: refundId }
          );
          if (current.amount.amountMinor > remainingExcludingSelf.amountMinor) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
              "Cannot approve refund above remaining reserved capacity.",
              {
                refundId,
                remainingMinor: remainingExcludingSelf.amountMinor,
                attemptedMinor: current.amount.amountMinor,
              }
            );
          }
          const next = approveRefund(current, { approvedAt: ctx.occurredAt });
          const saved = refundRepository.update(ctx.tenantId, refundId, next);
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.REFUND_APPROVED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:refund-approved:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              refundId: saved.refundId,
              paymentId: saved.paymentId,
            },
            amountMinor: saved.amount.amountMinor,
            currency: saved.currency,
            payload: { refundId: saved.refundId, status: saved.status },
          });
          return Object.freeze({
            refund: saved,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    rejectRefund(command = {}) {
      const ctx = requireCommandContext(command);
      const refundId = requireCommandId(command.refundId, "refundId");
      return executeIdempotent(
        { idempotencyRepository },
        REFUND_OPERATIONS.REJECT_REFUND,
        command,
        { refundId, reason: command.reason ?? null },
        () => {
          const current = refundRepository.getById(ctx.tenantId, refundId);
          const next = rejectRefund(current, {
            rejectedAt: ctx.occurredAt,
            reason: command.reason,
          });
          const saved = refundRepository.update(ctx.tenantId, refundId, next);
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.REFUND_REJECTED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:refund-rejected:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              refundId: saved.refundId,
              paymentId: saved.paymentId,
            },
            amountMinor: saved.amount.amountMinor,
            currency: saved.currency,
            reason: saved.reason,
            payload: { refundId: saved.refundId, status: saved.status },
          });
          return Object.freeze({
            refund: saved,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    completeRefund(command = {}) {
      const ctx = requireCommandContext(command);
      const refundId = requireCommandId(command.refundId, "refundId");
      const evidenceRef = requireCommandId(command.evidenceRef, "evidenceRef");

      return executeIdempotent(
        { idempotencyRepository },
        REFUND_OPERATIONS.COMPLETE_REFUND,
        command,
        {
          refundId,
          evidenceRef,
          auditEvidenceRef: command.auditEvidenceRef ?? null,
        },
        () => {
          const current = refundRepository.getById(ctx.tenantId, refundId);
          const payment = paymentRepository.getById(
            ctx.tenantId,
            current.paymentId
          );
          // Aggregate completed refunds must not exceed original payment.
          // Other in-flight reservations remain reserved and are excluded from
          // the completed-amount check inside recordPaymentRefund.
          const { refund, payment: updatedPayment } = completeRefund(
            current,
            payment,
            {
              evidenceRef,
              auditEvidenceRef: command.auditEvidenceRef,
              completedAt: ctx.occurredAt,
            }
          );
          const savedRefund = refundRepository.update(
            ctx.tenantId,
            refundId,
            refund
          );
          const savedPayment = paymentRepository.update(
            ctx.tenantId,
            updatedPayment.paymentId,
            {
              ...updatedPayment,
              updatedAt: ctx.occurredAt,
            }
          );
          const remaining = remainingRefundableForPayment(
            ctx.tenantId,
            savedPayment.paymentId
          );
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.REFUND_COMPLETED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: savedRefund.venueId,
            clubId: savedRefund.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:refund-completed:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              refundId: savedRefund.refundId,
              paymentId: savedRefund.paymentId,
            },
            amountMinor: savedRefund.amount.amountMinor,
            currency: savedRefund.currency,
            evidenceRef,
            evidenceReferences: [evidenceRef],
            payload: {
              refundId: savedRefund.refundId,
              paymentId: savedPayment.paymentId,
              refundedAmountMinor: savedPayment.refundedAmount.amountMinor,
              remainingRefundableMinor: remaining.amountMinor,
            },
          });
          return Object.freeze({
            refund: savedRefund,
            payment: savedPayment,
            remainingRefundable: remaining,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    /**
     * Initiate refund at provider after Finance approval.
     * Does not complete Finance refund domain state.
     */
    initiateProviderRefund(command = {}) {
      if (!paymentProvider) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "paymentProvider is required for initiateProviderRefund."
        );
      }
      const ctx = requireCommandContext(command);
      const refundId = requireCommandId(command.refundId, "refundId");
      const providerCode = requireCommandId(command.providerCode, "providerCode");
      const providerPaymentReference = requireCommandId(
        command.providerPaymentReference,
        "providerPaymentReference"
      );

      return executeIdempotent(
        { idempotencyRepository },
        REFUND_OPERATIONS.INITIATE_PROVIDER_REFUND,
        command,
        {
          refundId,
          providerCode,
          providerPaymentReference,
        },
        () => {
          const refund = refundRepository.getById(ctx.tenantId, refundId);
          if (refund.status !== REFUND_STATUS.APPROVED) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_TRANSITION,
              "Provider refund initiation requires an approved refund.",
              { refundId, status: refund.status }
            );
          }
          const payment = paymentRepository.getById(ctx.tenantId, refund.paymentId);
          const remainingExcludingSelf = remainingRefundableForPayment(
            ctx.tenantId,
            payment.paymentId,
            { excludeRefundId: refundId }
          );
          if (refund.amount.amountMinor > remainingExcludingSelf.amountMinor) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
              "Refund exceeds remaining refundable amount before provider call.",
              {
                refundId,
                remainingMinor: remainingExcludingSelf.amountMinor,
                attemptedMinor: refund.amount.amountMinor,
              }
            );
          }

          const providerResult = paymentProvider.initiateRefund(
            {
              tenantId: ctx.tenantId,
              operationId: refundId,
              idempotencyKey: ctx.idempotencyKey,
              correlationId: ctx.correlationId,
              causationId: ctx.causationId,
              providerCode,
              paymentId: payment.paymentId,
              refundId,
              occurredAt: ctx.occurredAt,
            },
            {
              tenantId: ctx.tenantId,
              paymentId: payment.paymentId,
              refundId,
              providerPaymentReference,
              amountMinor: refund.amount.amountMinor,
              currency: refund.currency,
              idempotencyKey: ctx.idempotencyKey,
              correlationId: ctx.correlationId,
              reason: refund.reason,
            }
          );

          return Object.freeze({
            refund,
            payment,
            providerResult,
            eventIds: [],
            financialEffectApplied: true,
          });
        }
      );
    },

    /**
     * Query provider refund status; complete Finance refund only when verified completed.
     */
    verifyAndCompleteRefund(command = {}) {
      if (!paymentProvider) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "paymentProvider is required for verifyAndCompleteRefund."
        );
      }
      const ctx = requireCommandContext(command);
      const refundId = requireCommandId(command.refundId, "refundId");
      const providerCode = requireCommandId(command.providerCode, "providerCode");
      const providerRefundReference = requireCommandId(
        command.providerRefundReference,
        "providerRefundReference"
      );

      return executeIdempotent(
        { idempotencyRepository },
        REFUND_OPERATIONS.VERIFY_AND_COMPLETE_REFUND,
        command,
        {
          refundId,
          providerCode,
          providerRefundReference,
        },
        () => {
          const statusResult = paymentProvider.queryRefundStatus(
            {
              tenantId: ctx.tenantId,
              operationId: `refund-status-${refundId}`,
              idempotencyKey: ctx.idempotencyKey,
              correlationId: ctx.correlationId,
              causationId: ctx.causationId,
              providerCode,
              refundId,
              occurredAt: ctx.occurredAt,
            },
            { providerRefundReference }
          );

          if (statusResult.status !== "COMPLETED") {
            throw new FinanceError(
              FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
              "Provider refund is not completed; Finance refund not completed.",
              {
                refundId,
                providerStatus: statusResult.status,
              }
            );
          }

          const evidenceRef =
            statusResult.evidence?.evidenceRef ||
            requireCommandId(command.evidenceRef, "evidenceRef");

          return this.completeRefund({
            ...command,
            idempotencyKey: `${ctx.idempotencyKey}::complete`,
            refundId,
            evidenceRef,
          });
        }
      );
    },

    getRemainingRefundable(tenantId, paymentId) {
      return remainingRefundableForPayment(tenantId, paymentId);
    },
  };
}
