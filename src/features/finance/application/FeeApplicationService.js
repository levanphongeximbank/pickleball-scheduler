/**
 * FeeApplicationService — register FeeDefinitions and evaluate FeePolicy.
 */

import {
  createFeeDefinition,
  evaluateFeeDefinition,
} from "../domain/feeDefinition.js";
import { createFeePolicy, evaluateFeePolicy } from "../contracts/feePolicy.js";
import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { executeIdempotent } from "./idempotentExecution.js";
import {
  optionalCommandId,
  requireCommandContext,
  requireCommandId,
} from "./commandSupport.js";

export const FEE_OPERATIONS = Object.freeze({
  REGISTER_FEE_DEFINITION: "REGISTER_FEE_DEFINITION",
  EVALUATE_FEE_POLICY: "EVALUATE_FEE_POLICY",
});

/**
 * @param {object} deps
 * @param {object} deps.feeDefinitionRepository
 * @param {object} deps.idempotencyRepository
 */
export function createFeeApplicationService(deps = {}) {
  const feeDefinitionRepository = deps.feeDefinitionRepository;
  const idempotencyRepository = deps.idempotencyRepository;

  if (!feeDefinitionRepository) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "feeDefinitionRepository is required."
    );
  }

  return {
    /**
     * Register a valid FeeDefinition. Duplicate feeId/version conflicts fail.
     * @param {object} command
     */
    registerFeeDefinition(command = {}) {
      const ctx = requireCommandContext(command);
      const feeInput = {
        feeId: requireCommandId(command.feeId, "feeId"),
        feeType: command.feeType,
        name: command.name,
        amountMinor: command.amountMinor,
        currency: command.currency,
        effectiveFrom: command.effectiveFrom,
        effectiveTo: command.effectiveTo,
        tenantId: ctx.tenantId,
        venueId: command.venueId,
        clubId: command.clubId,
        competitionRef: command.competitionRef,
        bookingRef: command.bookingRef,
        status: command.status,
        policyVersion: command.policyVersion,
      };

      return executeIdempotent(
        { idempotencyRepository },
        FEE_OPERATIONS.REGISTER_FEE_DEFINITION,
        command,
        {
          feeId: feeInput.feeId,
          feeType: feeInput.feeType,
          amountMinor: feeInput.amountMinor,
          currency: feeInput.currency,
          policyVersion: feeInput.policyVersion ?? 1,
          status: feeInput.status ?? "DRAFT",
          effectiveFrom: feeInput.effectiveFrom ?? null,
          effectiveTo: feeInput.effectiveTo ?? null,
          venueId: feeInput.venueId ?? null,
          clubId: feeInput.clubId ?? null,
          competitionRef: feeInput.competitionRef ?? null,
          bookingRef: feeInput.bookingRef ?? null,
          name: feeInput.name ?? null,
        },
        () => {
          const existing = feeDefinitionRepository.findById(
            ctx.tenantId,
            feeInput.feeId
          );
          if (existing) {
            throw new FinanceError(
              FINANCE_ERROR_CODES.CONFLICT,
              "FeeDefinition with this feeId already exists for tenant.",
              { tenantId: ctx.tenantId, feeId: feeInput.feeId }
            );
          }
          const fee = createFeeDefinition(feeInput);
          const saved = feeDefinitionRepository.save(fee);
          return Object.freeze({
            fee: saved,
            financialEffectApplied: true,
          });
        }
      );
    },

    /**
     * Deterministic evaluation of a FeeDefinition by id.
     * @param {object} command
     */
    evaluateFeeDefinition(command = {}) {
      const ctx = requireCommandContext(command);
      const feeId = requireCommandId(command.feeId, "feeId");
      const fee = feeDefinitionRepository.getById(ctx.tenantId, feeId);
      const evaluation = evaluateFeeDefinition(fee, {
        at: command.at ?? ctx.occurredAt,
        tenantId: ctx.tenantId,
        venueId: optionalCommandId(command.venueId, "venueId"),
        clubId: optionalCommandId(command.clubId, "clubId"),
      });
      return Object.freeze({ fee, evaluation, replayed: false });
    },

    /**
     * Evaluate a FeePolicy (inline or composed from registered fees).
     * @param {object} command
     */
    evaluateFeePolicy(command = {}) {
      requireCommandContext(command);
      const policy = createFeePolicy({
        policyId: requireCommandId(command.policyId, "policyId"),
        tenantId: command.tenantId,
        version: command.version,
        currency: command.currency,
        name: command.name,
        fees: command.fees,
      });
      const evaluation = evaluateFeePolicy(policy, {
        at: command.at ?? command.occurredAt ?? command.requestedAt,
        tenantId: command.tenantId,
        venueId: command.venueId,
        clubId: command.clubId,
        feeType: command.feeType,
        currency: command.currency,
      });
      return Object.freeze({ policy, evaluation, replayed: false });
    },
  };
}
