/**
 * ObligationApplicationService
 */

import {
  createObligation,
  openObligation,
  cancelObligation,
  expireObligation,
  applyObligationSettlement,
} from "../domain/obligation.js";
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

export const OBLIGATION_OPERATIONS = Object.freeze({
  CREATE_OBLIGATION: "CREATE_OBLIGATION",
  OPEN_OBLIGATION: "OPEN_OBLIGATION",
  CANCEL_OBLIGATION: "CANCEL_OBLIGATION",
  EXPIRE_OBLIGATION: "EXPIRE_OBLIGATION",
});

/**
 * @param {object} deps
 */
export function createObligationApplicationService(deps = {}) {
  const obligationRepository = deps.obligationRepository;
  const feeDefinitionRepository = deps.feeDefinitionRepository;
  const idempotencyRepository = deps.idempotencyRepository;
  const eventRecorder = deps.eventRecorder;
  const idGenerator = requireIdGenerator(deps);

  if (!obligationRepository || !eventRecorder) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "obligationRepository and eventRecorder are required."
    );
  }

  return {
    /**
     * Create an obligation from an evaluated / registered fee (or explicit amount).
     * @param {object} command
     */
    createObligation(command = {}) {
      const ctx = requireCommandContext(command);
      const obligationId =
        optionalCommandId(command.obligationId, "obligationId") ||
        idGenerator("obligation");

      let amountMinor = command.amountMinor;
      let currency = command.currency;
      let feeId = optionalCommandId(command.feeId, "feeId");

      if (feeId) {
        if (!feeDefinitionRepository) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.INVALID_INPUT,
            "feeDefinitionRepository is required when feeId is provided."
          );
        }
        const fee = feeDefinitionRepository.getById(ctx.tenantId, feeId);
        amountMinor = amountMinor ?? fee.amountMinor;
        currency = currency ?? fee.currency;
      }

      return executeIdempotent(
        { idempotencyRepository },
        OBLIGATION_OPERATIONS.CREATE_OBLIGATION,
        command,
        {
          obligationId,
          feeId,
          amountMinor,
          currency,
          subjectRef: command.subjectRef ?? null,
          venueId: command.venueId ?? null,
          clubId: command.clubId ?? null,
          competitionRef: command.competitionRef ?? null,
          bookingRef: command.bookingRef ?? null,
          dueAt: command.dueAt ?? null,
        },
        () => {
          const obligation = createObligation({
            obligationId,
            tenantId: ctx.tenantId,
            venueId: command.venueId,
            clubId: command.clubId,
            subjectRef: command.subjectRef,
            feeId,
            competitionRef: command.competitionRef,
            bookingRef: command.bookingRef,
            amountMinor,
            currency,
            dueAt: command.dueAt,
            createdAt: ctx.occurredAt,
            updatedAt: ctx.occurredAt,
          });
          const saved = obligationRepository.save(obligation);
          const event = eventRecorder.record({
            eventType: FINANCE_EVENT_TYPE.FINANCE_OBLIGATION_CREATED,
            occurredAt: ctx.occurredAt,
            tenantId: ctx.tenantId,
            venueId: saved.venueId,
            clubId: saved.clubId,
            correlationId: ctx.correlationId,
            causationId: ctx.causationId,
            eventIdempotencyKey: `evt:${ctx.tenantId}:obligation-created:${ctx.idempotencyKey}`,
            actor: ctx.actor,
            financialReferences: { obligationId: saved.obligationId, feeId: saved.feeId },
            amountMinor: saved.amount.amountMinor,
            currency: saved.currency,
            payload: { obligationId: saved.obligationId, status: saved.status },
          });
          return Object.freeze({
            obligation: saved,
            eventIds: [event.eventId],
            financialEffectApplied: true,
          });
        }
      );
    },

    openObligation(command = {}) {
      const ctx = requireCommandContext(command);
      const obligationId = requireCommandId(command.obligationId, "obligationId");
      return executeIdempotent(
        { idempotencyRepository },
        OBLIGATION_OPERATIONS.OPEN_OBLIGATION,
        command,
        { obligationId },
        () => {
          const current = obligationRepository.getById(ctx.tenantId, obligationId);
          const next = openObligation({
            ...current,
            updatedAt: ctx.occurredAt,
          });
          const saved = obligationRepository.update(
            ctx.tenantId,
            obligationId,
            { ...next, updatedAt: ctx.occurredAt }
          );
          return Object.freeze({
            obligation: saved,
            eventIds: [],
            financialEffectApplied: true,
          });
        }
      );
    },

    cancelObligation(command = {}) {
      const ctx = requireCommandContext(command);
      const obligationId = requireCommandId(command.obligationId, "obligationId");
      return executeIdempotent(
        { idempotencyRepository },
        OBLIGATION_OPERATIONS.CANCEL_OBLIGATION,
        command,
        { obligationId, reason: command.reason ?? null },
        () => {
          const current = obligationRepository.getById(ctx.tenantId, obligationId);
          const next = cancelObligation(current, { reason: command.reason });
          const saved = obligationRepository.update(ctx.tenantId, obligationId, {
            ...next,
            updatedAt: ctx.occurredAt,
          });
          return Object.freeze({
            obligation: saved,
            eventIds: [],
            financialEffectApplied: true,
          });
        }
      );
    },

    expireObligation(command = {}) {
      const ctx = requireCommandContext(command);
      const obligationId = requireCommandId(command.obligationId, "obligationId");
      return executeIdempotent(
        { idempotencyRepository },
        OBLIGATION_OPERATIONS.EXPIRE_OBLIGATION,
        command,
        { obligationId, reason: command.reason ?? null },
        () => {
          const current = obligationRepository.getById(ctx.tenantId, obligationId);
          const next = expireObligation(current, { reason: command.reason });
          const saved = obligationRepository.update(ctx.tenantId, obligationId, {
            ...next,
            updatedAt: ctx.occurredAt,
          });
          return Object.freeze({
            obligation: saved,
            eventIds: [],
            financialEffectApplied: true,
          });
        }
      );
    },

    /**
     * Apply settlement only through confirmed Finance payments (called by Payment service).
     * Not exposed as a public customer command in the facade — used by orchestration.
     * @param {object} params
     */
    applySettlementFromConfirmedPayment(params = {}) {
      const tenantId = requireCommandId(params.tenantId, "tenantId");
      const obligationId = requireCommandId(params.obligationId, "obligationId");
      const current = obligationRepository.getById(tenantId, obligationId);
      const next = applyObligationSettlement(current, {
        amountMinor: params.amountMinor,
        currency: params.currency,
      });
      return obligationRepository.update(tenantId, obligationId, {
        ...next,
        updatedAt: params.occurredAt || current.updatedAt,
      });
    },
  };
}
