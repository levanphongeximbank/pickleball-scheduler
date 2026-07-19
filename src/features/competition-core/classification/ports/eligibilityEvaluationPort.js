import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  classificationError,
  classificationFail,
  classificationOk,
} from "../errors/classificationError.js";

/**
 * Narrow eligibility evaluation port — Core-01 implements; Core-04 never evaluates.
 *
 * Core-04 sends descriptor / policy refs only.
 * Core-01 returns structured accept/reject.
 */

/**
 * @typedef {Object} EligibilityEvaluationRequest
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} divisionCategoryId
 * @property {import('../contracts/eligibility.js').EligibilityDescriptor|null} [eligibilityDescriptor]
 * @property {string|null} [eligibilityPolicyRef]
 * @property {{ kind: string, id: string }} participantOrEntryRef
 * @property {Record<string, unknown>} [context]
 */

/**
 * @typedef {Object} EligibilityEvaluationResult
 * @property {'accepted'|'rejected'} decision
 * @property {string[]} rejectionCodes
 * @property {string[]} [ruleEvaluationRefs]
 * @property {import('../contracts/shared.js').ClassificationAuditMetadata} [audit]
 * @property {Record<string, unknown>} [details]
 */

export const ELIGIBILITY_EVALUATION_PORT_METHODS = Object.freeze([
  "evaluateEligibility",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function isEligibilityEvaluationPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {any} */ (port).evaluateEligibility === "function"
  );
}

/**
 * Invoke an injected Core-01 eligibility port. Core-04 does not evaluate.
 *
 * @param {{ evaluateEligibility: (req: EligibilityEvaluationRequest) => Promise<EligibilityEvaluationResult>|EligibilityEvaluationResult }} port
 * @param {EligibilityEvaluationRequest} request
 * @returns {Promise<EligibilityEvaluationResult>}
 */
export async function requestEligibilityEvaluation(port, request) {
  if (!isEligibilityEvaluationPort(port)) {
    throw new Error("EligibilityEvaluationPort.evaluateEligibility is required");
  }
  return port.evaluateEligibility(request);
}

/**
 * Map port result into CLASSIFICATION_* structured rejection when rejected.
 *
 * @param {EligibilityEvaluationResult} result
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function mapEligibilityPortResult(result) {
  if (result?.decision === "accepted") {
    return classificationOk(result);
  }
  return classificationFail([
    classificationError(
      CLASSIFICATION_ERROR_CODE.ELIGIBILITY_REJECTED,
      "eligibility",
      "Eligibility evaluation rejected by Core-01 port",
      {
        rejectionCodes: Array.isArray(result?.rejectionCodes) ? result.rejectionCodes : [],
        ruleEvaluationRefs: Array.isArray(result?.ruleEvaluationRefs)
          ? result.ruleEvaluationRefs
          : [],
        details: result?.details || null,
      }
    ),
  ]);
}
