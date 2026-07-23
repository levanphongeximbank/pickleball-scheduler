/**
 * InvoiceApplicationService
 */

import {
  createInvoice,
  createInvoiceItem,
  issueInvoice,
  voidInvoice,
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

export const INVOICE_OPERATIONS = Object.freeze({
  CREATE_INVOICE: "CREATE_INVOICE",
  ISSUE_INVOICE: "ISSUE_INVOICE",
  VOID_INVOICE: "VOID_INVOICE",
});

/**
 * @param {object} deps
 */
export function createInvoiceApplicationService(deps = {}) {
  const invoiceRepository = deps.invoiceRepository;
  const obligationRepository = deps.obligationRepository;
  const idempotencyRepository = deps.idempotencyRepository;
  const eventRecorder = deps.eventRecorder;
  const idGenerator = requireIdGenerator(deps);

  if (!invoiceRepository || !eventRecorder) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "invoiceRepository and eventRecorder are required."
    );
  }

  return {
    /**
     * Create a draft invoice from one or more obligations (or explicit items).
     * @param {object} command
     */
    createInvoice(command = {}) {
      const ctx = requireCommandContext(command);
      const invoiceId =
        optionalCommandId(command.invoiceId, "invoiceId") ||
        idGenerator("invoice");

      return executeIdempotent(
        { idempotencyRepository },
        INVOICE_OPERATIONS.CREATE_INVOICE,
        command,
        {
          invoiceId,
          obligationIds: Array.isArray(command.obligationIds)
            ? [...command.obligationIds].sort()
            : command.obligationId
              ? [command.obligationId]
              : [],
          items: Array.isArray(command.items) ? command.items : null,
          currency: command.currency ?? null,
        },
        () => {
          let items = [];
          let currency = command.currency;
          let primaryObligationId = optionalCommandId(
            command.obligationId,
            "obligationId"
          );

          if (Array.isArray(command.items) && command.items.length > 0) {
            items = command.items;
          } else {
            const obligationIds = Array.isArray(command.obligationIds)
              ? command.obligationIds
              : primaryObligationId
                ? [primaryObligationId]
                : [];
            if (!obligationIds.length) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.INVALID_INPUT,
                "createInvoice requires items or obligationIds.",
                { field: "obligationIds" }
              );
            }
            if (!obligationRepository) {
              throw new FinanceError(
                FINANCE_ERROR_CODES.INVALID_INPUT,
                "obligationRepository is required when creating from obligations."
              );
            }
            for (const oid of obligationIds) {
              const obligation = obligationRepository.getById(
                ctx.tenantId,
                requireCommandId(oid, "obligationId")
              );
              currency = currency || obligation.currency;
              if (obligation.currency !== currency) {
                throw new FinanceError(
                  FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
                  "All obligations on an invoice must share one currency.",
                  { invoiceId }
                );
              }
              items.push(
                createInvoiceItem(
                  {
                    itemId: idGenerator("invoice-item"),
                    description: `Obligation ${obligation.obligationId}`,
                    quantity: 1,
                    amountMinor: obligation.amount.amountMinor,
                    currency: obligation.currency,
                    feeId: obligation.feeId,
                    obligationId: obligation.obligationId,
                  },
                  obligation.currency
                )
              );
            }
            primaryObligationId = primaryObligationId || obligationIds[0];
          }

          const invoice = createInvoice({
            invoiceId,
            tenantId: ctx.tenantId,
            venueId: command.venueId,
            clubId: command.clubId,
            obligationId: primaryObligationId,
            currency,
            items,
            createdAt: ctx.occurredAt,
            updatedAt: ctx.occurredAt,
          });
          const saved = invoiceRepository.save(invoice);
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.INVOICE_CREATED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:invoice-created:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: {
              invoiceId: saved.invoiceId,
              obligationId: saved.obligationId,
            },
            amountMinor: saved.total.amountMinor,
            currency: saved.currency,
            payload: { invoiceId: saved.invoiceId, status: saved.status },
          });
          return Object.freeze({
            invoice: saved,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    issueInvoice(command = {}) {
      const ctx = requireCommandContext(command);
      const invoiceId = requireCommandId(command.invoiceId, "invoiceId");
      return executeIdempotent(
        { idempotencyRepository },
        INVOICE_OPERATIONS.ISSUE_INVOICE,
        command,
        { invoiceId },
        () => {
          const current = invoiceRepository.getById(ctx.tenantId, invoiceId);
          const next = issueInvoice(current, { issuedAt: ctx.occurredAt });
          const saved = invoiceRepository.update(ctx.tenantId, invoiceId, {
            ...next,
            updatedAt: ctx.occurredAt,
          });
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.INVOICE_ISSUED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:invoice-issued:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: { invoiceId: saved.invoiceId },
            amountMinor: saved.total.amountMinor,
            currency: saved.currency,
            payload: { invoiceId: saved.invoiceId, status: saved.status },
          });
          return Object.freeze({
            invoice: saved,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    voidInvoice(command = {}) {
      const ctx = requireCommandContext(command);
      const invoiceId = requireCommandId(command.invoiceId, "invoiceId");
      return executeIdempotent(
        { idempotencyRepository },
        INVOICE_OPERATIONS.VOID_INVOICE,
        command,
        { invoiceId, reason: command.reason ?? null },
        () => {
          const current = invoiceRepository.getById(ctx.tenantId, invoiceId);
          const next = voidInvoice(current, {
            voidedAt: ctx.occurredAt,
            reason: command.reason,
          });
          const saved = invoiceRepository.update(ctx.tenantId, invoiceId, {
            ...next,
            updatedAt: ctx.occurredAt,
          });
          return Object.freeze({
            invoice: saved,
            eventIds: [],
            financialEffectApplied: true,
          });
        }
      );
    },

    /**
     * Bookkeeping payment hint after confirmed payment (internal orchestration).
     * @param {object} params
     */
    applyPaymentHintFromConfirmedPayment(params = {}) {
      const tenantId = requireCommandId(params.tenantId, "tenantId");
      const invoiceId = requireCommandId(params.invoiceId, "invoiceId");
      const current = invoiceRepository.getById(tenantId, invoiceId);
      assertIssuedInvoiceImmutable(current, current);
      const next = applyInvoicePaymentHint(current, {
        amountMinor: params.amountMinor,
        currency: params.currency,
      });
      return invoiceRepository.update(tenantId, invoiceId, {
        ...next,
        updatedAt: params.occurredAt || current.updatedAt,
      });
    },
  };
}
