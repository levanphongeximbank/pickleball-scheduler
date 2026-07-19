import {
  ELIGIBILITY_CHECK_TYPE,
  isEligibilityCheckType,
} from "../enums/eligibilityCheckType.js";
import {
  ELIGIBILITY_OUTCOME,
  isEligibilityOutcome,
} from "../enums/eligibilityOutcome.js";
import {
  ELIGIBILITY_REASON_SEVERITY,
  ELIGIBILITY_REASON_SEVERITY_RANK,
  isEligibilityReasonSeverity,
} from "../enums/eligibilityReasonSeverity.js";
import { COMPETITION_FORMAT_HINT, isCompetitionFormatHint } from "../enums/competitionFormatHint.js";
import {
  createAuditMetadata,
  ELIGIBILITY_EVALUATOR_VERSION,
  isNonEmptyString,
  REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
} from "./shared.js";
import { createRegistrationTarget } from "./registrationTarget.js";

/**
 * @typedef {Object} EligibilityReason
 * @property {string} code
 * @property {string} checkType
 * @property {string} severity
 * @property {string} message
 * @property {Record<string, unknown>|null} [details]
 */

/**
 * @typedef {Object} EligibilityCheckResult
 * @property {string} checkType
 * @property {boolean} passed
 * @property {EligibilityReason[]} reasons
 * @property {string|null} [ruleRef]
 * @property {string|null} [evaluatedAt]
 */

/**
 * @typedef {Object} EligibilityPolicy
 * @property {string} schemaVersion
 * @property {string} policyId
 * @property {string|null} [ruleSetId]
 * @property {string|null} [ruleSetVersion]
 * @property {string[]} [requiredCheckTypes]
 * @property {boolean} [allowConditional]
 * @property {boolean} [requireManualApproval]
 * @property {Record<string, unknown>|null} [parameters]
 */

/**
 * @typedef {Object} EligibilityEvaluationContext
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {string|null} [divisionCategoryId]
 * @property {string|null} [categoryId]
 * @property {string} [formatHint]
 * @property {import('./registrationTarget.js').RegistrationTarget} target
 * @property {string|null} [registrationId]
 * @property {string|null} [idempotencyKey]
 * @property {string|null} [registrationRequestId]
 * @property {string} evaluatedAt
 * @property {string|null} [ruleSetId]
 * @property {string|null} [ruleSetVersion]
 * @property {EligibilityPolicy|null} [policy]
 * @property {Record<string, unknown>|null} [snapshots]
 * @property {Record<string, unknown>|null} [metadata]
 */

/**
 * @typedef {Object} EligibilityDecision
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} outcome
 * @property {EligibilityReason[]} reasons
 * @property {EligibilityCheckResult[]} checkResults
 * @property {string} evaluatedAt
 * @property {string} evaluatorVersion
 * @property {string|null} [ruleSetId]
 * @property {string|null} [ruleSetVersion]
 * @property {string|null} [registrationId]
 * @property {string|null} [competitionId]
 * @property {Record<string, unknown>|null} [evidenceSnapshot]
 * @property {import('./shared.js').RegistrationAuditMetadata} [audit]
 */

/**
 * @param {Partial<EligibilityReason>} partial
 * @returns {EligibilityReason}
 */
export function createEligibilityReason(partial = {}) {
  const severity = isEligibilityReasonSeverity(partial.severity)
    ? partial.severity
    : ELIGIBILITY_REASON_SEVERITY.INFO;
  const checkType = isEligibilityCheckType(partial.checkType)
    ? partial.checkType
    : ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL;

  if (!isNonEmptyString(partial.code)) {
    throw new TypeError("EligibilityReason requires code");
  }

  return Object.freeze({
    code: String(partial.code).trim(),
    checkType,
    severity,
    message: String(partial.message || partial.code),
    details:
      partial.details && typeof partial.details === "object" && !Array.isArray(partial.details)
        ? { ...partial.details }
        : null,
  });
}

/**
 * Deterministic ordering: severity rank → checkType → code → message.
 * @param {EligibilityReason[]} reasons
 * @returns {EligibilityReason[]}
 */
export function orderEligibilityReasons(reasons = []) {
  return [...reasons]
    .map((r) => createEligibilityReason(r))
    .sort((a, b) => {
      const rankA = ELIGIBILITY_REASON_SEVERITY_RANK[a.severity] ?? 99;
      const rankB = ELIGIBILITY_REASON_SEVERITY_RANK[b.severity] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      if (a.checkType !== b.checkType) return a.checkType < b.checkType ? -1 : 1;
      if (a.code !== b.code) return a.code < b.code ? -1 : 1;
      if (a.message !== b.message) return a.message < b.message ? -1 : 1;
      return 0;
    });
}

/**
 * @param {Partial<EligibilityCheckResult>} partial
 * @returns {EligibilityCheckResult}
 */
export function createEligibilityCheckResult(partial = {}) {
  const checkType = isEligibilityCheckType(partial.checkType)
    ? partial.checkType
    : null;
  if (!checkType) {
    throw new TypeError("EligibilityCheckResult requires checkType");
  }
  const reasons = orderEligibilityReasons(
    Array.isArray(partial.reasons) ? partial.reasons : []
  );
  return Object.freeze({
    checkType,
    passed: Boolean(partial.passed),
    reasons,
    ruleRef:
      partial.ruleRef != null && String(partial.ruleRef).trim() !== ""
        ? String(partial.ruleRef).trim()
        : null,
    evaluatedAt:
      partial.evaluatedAt != null && String(partial.evaluatedAt).trim() !== ""
        ? String(partial.evaluatedAt).trim()
        : null,
  });
}

/**
 * @param {Partial<EligibilityPolicy>} partial
 * @returns {EligibilityPolicy}
 */
export function createEligibilityPolicy(partial = {}) {
  if (!isNonEmptyString(partial.policyId)) {
    throw new TypeError("EligibilityPolicy requires policyId");
  }
  const requiredCheckTypes = Array.isArray(partial.requiredCheckTypes)
    ? partial.requiredCheckTypes.filter((t) => isEligibilityCheckType(t))
    : [];

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    policyId: String(partial.policyId).trim(),
    ruleSetId:
      partial.ruleSetId != null && String(partial.ruleSetId).trim() !== ""
        ? String(partial.ruleSetId).trim()
        : null,
    ruleSetVersion:
      partial.ruleSetVersion != null && String(partial.ruleSetVersion).trim() !== ""
        ? String(partial.ruleSetVersion).trim()
        : null,
    requiredCheckTypes,
    allowConditional: partial.allowConditional !== false,
    requireManualApproval: Boolean(partial.requireManualApproval),
    parameters:
      partial.parameters &&
      typeof partial.parameters === "object" &&
      !Array.isArray(partial.parameters)
        ? { ...partial.parameters }
        : null,
  });
}

/**
 * @param {Partial<EligibilityEvaluationContext>} partial
 * @returns {EligibilityEvaluationContext}
 */
export function createEligibilityEvaluationContext(partial = {}) {
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("EligibilityEvaluationContext requires competitionId");
  }
  if (!isNonEmptyString(partial.evaluatedAt)) {
    throw new TypeError("EligibilityEvaluationContext requires evaluatedAt from ClockPort");
  }
  if (!partial.target) {
    throw new TypeError("EligibilityEvaluationContext requires target");
  }

  const formatHint = isCompetitionFormatHint(partial.formatHint)
    ? partial.formatHint
    : COMPETITION_FORMAT_HINT.UNSPECIFIED;

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    divisionCategoryId:
      partial.divisionCategoryId != null && String(partial.divisionCategoryId).trim() !== ""
        ? String(partial.divisionCategoryId).trim()
        : null,
    categoryId:
      partial.categoryId != null && String(partial.categoryId).trim() !== ""
        ? String(partial.categoryId).trim()
        : null,
    formatHint,
    target: createRegistrationTarget(partial.target),
    registrationId:
      partial.registrationId != null && String(partial.registrationId).trim() !== ""
        ? String(partial.registrationId).trim()
        : null,
    idempotencyKey:
      partial.idempotencyKey != null && String(partial.idempotencyKey).trim() !== ""
        ? String(partial.idempotencyKey).trim()
        : null,
    registrationRequestId:
      partial.registrationRequestId != null &&
      String(partial.registrationRequestId).trim() !== ""
        ? String(partial.registrationRequestId).trim()
        : null,
    evaluatedAt: String(partial.evaluatedAt).trim(),
    ruleSetId:
      partial.ruleSetId != null && String(partial.ruleSetId).trim() !== ""
        ? String(partial.ruleSetId).trim()
        : null,
    ruleSetVersion:
      partial.ruleSetVersion != null && String(partial.ruleSetVersion).trim() !== ""
        ? String(partial.ruleSetVersion).trim()
        : null,
    policy: partial.policy ? createEligibilityPolicy(partial.policy) : null,
    snapshots:
      partial.snapshots &&
      typeof partial.snapshots === "object" &&
      !Array.isArray(partial.snapshots)
        ? { ...partial.snapshots }
        : null,
    metadata:
      partial.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : null,
  });
}

/**
 * Aggregate check results into a deterministic EligibilityDecision (pure).
 * Does not generate random IDs — caller supplies id (via IdGeneratorPort outside domain eval).
 *
 * @param {{
 *   id: string,
 *   checkResults?: EligibilityCheckResult[],
 *   evaluatedAt: string,
 *   registrationId?: string|null,
 *   competitionId?: string|null,
 *   ruleSetId?: string|null,
 *   ruleSetVersion?: string|null,
 *   evidenceSnapshot?: Record<string, unknown>|null,
 *   policy?: EligibilityPolicy|null,
 *   evaluatorVersion?: string,
 * }} input
 * @returns {EligibilityDecision}
 */
export function createEligibilityDecision(input = {}) {
  if (!isNonEmptyString(input.id)) {
    throw new TypeError("EligibilityDecision requires id from IdGeneratorPort");
  }
  if (!isNonEmptyString(input.evaluatedAt)) {
    throw new TypeError("EligibilityDecision requires evaluatedAt from ClockPort");
  }

  const checkResults = (Array.isArray(input.checkResults) ? input.checkResults : []).map(
    (c) => createEligibilityCheckResult(c)
  );

  /** @type {EligibilityReason[]} */
  const reasons = orderEligibilityReasons(checkResults.flatMap((c) => c.reasons));

  const hasBlocking = reasons.some((r) => r.severity === ELIGIBILITY_REASON_SEVERITY.BLOCKING);
  const hasManual = reasons.some(
    (r) =>
      r.checkType === ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL ||
      r.code === "MANUAL_REVIEW_REQUIRED"
  );
  const hasConditional = reasons.some(
    (r) =>
      r.severity === ELIGIBILITY_REASON_SEVERITY.WARNING &&
      (r.code.startsWith("CONDITIONAL_") || r.code === "CONDITIONAL_REQUIREMENT")
  );

  let outcome = ELIGIBILITY_OUTCOME.ELIGIBLE;
  if (hasBlocking) {
    outcome = ELIGIBILITY_OUTCOME.INELIGIBLE;
  } else if (hasManual || input.policy?.requireManualApproval) {
    outcome = ELIGIBILITY_OUTCOME.MANUAL_REVIEW_REQUIRED;
  } else if (hasConditional && input.policy?.allowConditional !== false) {
    outcome = ELIGIBILITY_OUTCOME.CONDITIONAL;
  }

  if (!isEligibilityOutcome(outcome)) {
    outcome = ELIGIBILITY_OUTCOME.INELIGIBLE;
  }

  return Object.freeze({
    schemaVersion: REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
    id: String(input.id).trim(),
    outcome,
    reasons,
    checkResults,
    evaluatedAt: String(input.evaluatedAt).trim(),
    evaluatorVersion: String(input.evaluatorVersion || ELIGIBILITY_EVALUATOR_VERSION),
    ruleSetId:
      input.ruleSetId != null && String(input.ruleSetId).trim() !== ""
        ? String(input.ruleSetId).trim()
        : null,
    ruleSetVersion:
      input.ruleSetVersion != null && String(input.ruleSetVersion).trim() !== ""
        ? String(input.ruleSetVersion).trim()
        : null,
    registrationId:
      input.registrationId != null && String(input.registrationId).trim() !== ""
        ? String(input.registrationId).trim()
        : null,
    competitionId:
      input.competitionId != null && String(input.competitionId).trim() !== ""
        ? String(input.competitionId).trim()
        : null,
    evidenceSnapshot:
      input.evidenceSnapshot &&
      typeof input.evidenceSnapshot === "object" &&
      !Array.isArray(input.evidenceSnapshot)
        ? { ...input.evidenceSnapshot }
        : null,
    audit: createAuditMetadata({
      decidedAt: String(input.evaluatedAt).trim(),
      reason: outcome,
    }),
  });
}
