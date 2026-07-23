/**
 * ReceiptApplicationService — exactly one canonical receipt per confirmed payment.
 */

import { issueReceiptFromPayment } from "../domain/receipt.js";
import { PAYMENT_STATUS } from "../domain/payment.js";
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

export const RECEIPT_OPERATIONS = Object.freeze({
  ISSUE_RECEIPT: "ISSUE_RECEIPT",
});

/**
 * @param {object} deps
 */
export function createReceiptApplicationService(deps = {}) {
  const receiptRepository = deps.receiptRepository;
  const paymentRepository = deps.paymentRepository;
  const idempotencyRepository = deps.idempotencyRepository;
  const eventRecorder = deps.eventRecorder;
  const idGenerator = requireIdGenerator(deps);

  if (!receiptRepository || !paymentRepository || !eventRecorder) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "receiptRepository, paymentRepository, and eventRecorder are required."
    );
  }

  return {
    /**
     * Issue exactly one canonical receipt for a confirmed payment.
     * Idempotent replay returns the existing receipt.
     * @param {object} command
     */
    issueReceipt(command = {}) {
      const ctx = requireCommandContext(command);
      const paymentId = requireCommandId(command.paymentId, "paymentId");
      const receiptId =
        optionalCommandId(command.receiptId, "receiptId") ||
        idGenerator("receipt");

      return executeIdempotent(
        { idempotencyRepository },
        RECEIPT_OPERATIONS.ISSUE_RECEIPT,
        command,
        {
          paymentId,
          receiptId,
          evidenceRef: command.evidenceRef ?? null,
        },
        () => {
          const payment = paymentRepository.getById(ctx.tenantId, paymentId);
          if (payment.status !== PAYMENT_STATUS.CONFIRMED) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_TRANSITION,
              "Receipt requires a confirmed payment.",
              { paymentId, status: payment.status }
            );
          }

          const existing = receiptRepository.findByPaymentId(
            ctx.tenantId,
            paymentId
          );
          if (existing) {
            // Same payment already has a receipt — only allow when identity matches
            // via idempotent exact replay (handled above). Conflicting new receiptId fails.
            if (command.receiptId && command.receiptId !== existing.receiptId) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT,
                "A receipt already exists for this confirmed payment.",
                {
                  paymentId,
                  existingReceiptId: existing.receiptId,
                  requestedReceiptId: command.receiptId,
                }
              );
            }
            return Object.freeze({
              receipt: existing,
              eventIds: [],
              financialEffectApplied: false,
            });
          }

          const receipt = issueReceiptFromPayment(payment, {
            receiptId,
            issuedAt: ctx.occurredAt,
            evidenceRef: command.evidenceRef,
            auditEvidenceRef: command.auditEvidenceRef,
          });
          const saved = receiptRepository.save(receipt);
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.RECEIPT_ISSUED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:receipt-issued:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              receiptId: saved.receiptId,
              paymentId: saved.paymentId,
            },
            amountMinor: saved.amount.amountMinor,
            currency: saved.currency,
            evidenceRef: saved.evidenceRef,
            evidenceReferences: [saved.evidenceRef],
            payload: { receiptId: saved.receiptId, paymentId: saved.paymentId },
          });
          return Object.freeze({
            receipt: saved,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },
  };
}
