/**
 * RefundApplicationService — request / approve / reject / complete with evidence.
 * Supports multiple partial refunds without rewriting original payment amount.
 */

import {
  requestRefund,
  approveRefund,
  rejectRefund,
  completeRefund,
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
});

/**
 * @param {object} deps
 */
export function createRefundApplicationService(deps = {}) {
  const refundRepository = deps.refundRepository;
  const paymentRepository = deps.paymentRepository;
  const idempotencyRepository = deps.idempotencyRepository;
  const eventRecorder = deps.eventRecorder;
  const idGenerator = requireIdGenerator(deps);

  if (!refundRepository || !paymentRepository || !eventRecorder) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "refundRepository, paymentRepository, and eventRecorder are required."
    );
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
          const { refund } = requestRefund(payment, {
            refundId,
            amountMinor: command.amountMinor,
            currency: command.currency,
            reason: command.reason,
            requestedAt: ctx.occurredAt,
          });
          const saved = refundRepository.save(refund);
          const remaining = getRefundableAmount(payment);
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
          const remaining = getRefundableAmount(savedPayment);
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

    getRemainingRefundable(tenantId, paymentId) {
      const payment = paymentRepository.getById(tenantId, paymentId);
      return getRefundableAmount(payment);
    },
  };
}
