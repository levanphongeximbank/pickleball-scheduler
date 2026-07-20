import { orderEligibilityReasons } from "./eligibility.js";
import {
  createAuditMetadata,
  ELIGIBILITY_EVALUATOR_VERSION,
  isNonEmptyString,
  REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
} from "./shared.js";

/**
 * EligibilityEvaluationEvidence — durable evaluation snapshot for audit / replay.
 *
 * @typedef {Object} EligibilityEvaluationEvidence
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} evaluationRequestId
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} divisionId
 * @property {string} evaluatorVersion
 * @property {string|null} ruleSetId
 * @property {string|null} ruleSetVersion
 * @property {string[]} requiredCheckTypes
 * @property {import('./eligibility.js').EligibilityCheckResult[]} checkResults
 * @property {import('./eligibility.js').EligibilityReason[]} reasons
 * @property {string} outcome
 * @property {string} evaluatedAt
 * @property {string|null} correlationId
 * @property {string|null} requestId
 * @property {string|null} [canonicalRequestFingerprint] — Phase 1F additive
 * @property {string|null} [policyId] — Phase 1F additive
 * @property {string|null} [policyVersion] — Phase 1F additive
 * @property {string|null} [decisionId] — Phase 1F additive alias of eligibility decision
 * @property {Record<string, unknown>|null} [evidenceMetadata] — Phase 1F additive (no secrets)
 * @property {import('./shared.js').RegistrationAuditMetadata} [audit]
 */

/**
 * @param {Partial<EligibilityEvaluationEvidence>} partial
 * @returns {EligibilityEvaluationEvidence}
 */
export function createEligibilityEvaluationEvidence(partial = {}) {
  if (!isNonEmptyString(partial.id)) {
    throw new TypeError("EligibilityEvaluationEvidence requires id");
  }
  if (!isNonEmptyString(partial.evaluationRequestId)) {
    throw new TypeError("EligibilityEvaluationEvidence requires evaluationRequestId");
  }
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("EligibilityEvaluationEvidence requires registrationId");
  }
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("EligibilityEvaluationEvidence requires competitionId");
  }
  if (!isNonEmptyString(partial.outcome)) {
    throw new TypeError("EligibilityEvaluationEvidence requires outcome");
  }
  if (!isNonEmptyString(partial.evaluatedAt)) {
    throw new TypeError("EligibilityEvaluationEvidence requires evaluatedAt from ClockPort");
  }

  const checkResults = Array.isArray(partial.checkResults) ? partial.checkResults.slice() : [];
  const reasons = orderEligibilityReasons(
    Array.isArray(partial.reasons)
      ? partial.reasons
      : checkResults.flatMap((c) => c.reasons || [])
  );

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    id: String(partial.id).trim(),
    evaluationRequestId: String(partial.evaluationRequestId).trim(),
    registrationId: String(partial.registrationId).trim(),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    evaluatorVersion: String(partial.evaluatorVersion || ELIGIBILITY_EVALUATOR_VERSION),
    ruleSetId:
      partial.ruleSetId != null && String(partial.ruleSetId).trim() !== ""
        ? String(partial.ruleSetId).trim()
        : null,
    ruleSetVersion:
      partial.ruleSetVersion != null && String(partial.ruleSetVersion).trim() !== ""
        ? String(partial.ruleSetVersion).trim()
        : null,
    requiredCheckTypes: Array.isArray(partial.requiredCheckTypes)
      ? partial.requiredCheckTypes.map((t) => String(t))
      : [],
    checkResults,
    reasons,
    outcome: String(partial.outcome).trim(),
    evaluatedAt: String(partial.evaluatedAt).trim(),
    correlationId:
      partial.correlationId != null && String(partial.correlationId).trim() !== ""
        ? String(partial.correlationId).trim()
        : null,
    requestId:
      partial.requestId != null && String(partial.requestId).trim() !== ""
        ? String(partial.requestId).trim()
        : null,
    canonicalRequestFingerprint:
      partial.canonicalRequestFingerprint != null &&
      String(partial.canonicalRequestFingerprint).trim() !== ""
        ? String(partial.canonicalRequestFingerprint).trim()
        : null,
    policyId:
      partial.policyId != null && String(partial.policyId).trim() !== ""
        ? String(partial.policyId).trim()
        : null,
    policyVersion:
      partial.policyVersion != null && String(partial.policyVersion).trim() !== ""
        ? String(partial.policyVersion).trim()
        : null,
    decisionId:
      partial.decisionId != null && String(partial.decisionId).trim() !== ""
        ? String(partial.decisionId).trim()
        : String(partial.id).trim(),
    evidenceMetadata:
      partial.evidenceMetadata &&
      typeof partial.evidenceMetadata === "object" &&
      !Array.isArray(partial.evidenceMetadata)
        ? { ...partial.evidenceMetadata }
        : null,
    audit: createAuditMetadata(partial.audit),
  });
}
