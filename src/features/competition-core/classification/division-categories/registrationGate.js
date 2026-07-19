import { assertRegistrationAccepted } from "../validators/lifecycle.js";
import { enforceDivisionCategoryCapacity } from "../validators/capacity.js";
import {
  isEligibilityEvaluationPort,
  mapEligibilityPortResult,
  requestEligibilityEvaluation,
} from "../ports/eligibilityEvaluationPort.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  classificationError,
  classificationFail,
  classificationOk,
} from "../errors/classificationError.js";

/**
 * Gate a registration attempt against DivisionCategory lifecycle + capacity.
 * Optionally forwards eligibility to an injected Core-01 port (never evaluates locally).
 *
 * @param {import('./createCompetitionDivisionCategory.js').CompetitionDivisionCategory} lane
 * @param {{
 *   currentEntryCount: number,
 *   currentWaitlistCount?: number,
 *   participantType?: string|null,
 *   currentQuotaCounts?: Record<string, number>,
 *   eligibilityPort?: { evaluateEligibility: Function }|null,
 *   eligibilityRequest?: import('../ports/eligibilityEvaluationPort.js').EligibilityEvaluationRequest|null,
 * }} options
 * @returns {Promise<import('../errors/classificationError.js').ClassificationResult>}
 */
export async function gateDivisionCategoryRegistration(lane, options = {}) {
  const openGate = assertRegistrationAccepted(lane);
  if (!openGate.ok) {
    return openGate;
  }

  const capacityGate = enforceDivisionCategoryCapacity(lane, {
    currentEntryCount: options.currentEntryCount,
    currentWaitlistCount: options.currentWaitlistCount,
    participantType: options.participantType,
    currentQuotaCounts: options.currentQuotaCounts,
  });
  if (!capacityGate.ok) {
    return capacityGate;
  }

  if (options.eligibilityPort) {
    if (!isEligibilityEvaluationPort(options.eligibilityPort)) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.REQUIRED,
          "eligibilityPort",
          "eligibilityPort.evaluateEligibility is required when provided"
        ),
      ]);
    }
    if (!options.eligibilityRequest) {
      return classificationOk(capacityGate.value);
    }
    const evalResult = await requestEligibilityEvaluation(
      options.eligibilityPort,
      options.eligibilityRequest
    );
    const mapped = mapEligibilityPortResult(evalResult);
    if (!mapped.ok) {
      return mapped;
    }
  }

  return classificationOk(capacityGate.value);
}
