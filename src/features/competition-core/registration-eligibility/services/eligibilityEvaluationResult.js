/**
 * EligibilityEvaluationServiceResult — consistent operation outcome for Phase 1C.
 *
 * @typedef {Object} EligibilityEvaluationServiceResult
 * @property {boolean} ok
 * @property {string} operation
 * @property {string|null} registrationId
 * @property {import('../contracts/eligibility.js').EligibilityDecision|null} decision
 * @property {import('../contracts/eligibility.js').EligibilityCheckResult[]} checkResults
 * @property {import('../contracts/eligibilityEvaluationEvidence.js').EligibilityEvaluationEvidence|null} evidence
 * @property {string|null} auditEventId
 * @property {string|null} evaluatedAt
 * @property {string|null} evaluatorVersion
 * @property {boolean} replayed
 * @property {'MISS'|'HIT'|'CONFLICT'|null} idempotencyResult
 * @property {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} warnings
 * @property {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} [errors]
 * @property {Record<string, unknown>|null} [metadata]
 */

/**
 * @param {{
 *   operation: string,
 *   registrationId?: string|null,
 *   decision?: import('../contracts/eligibility.js').EligibilityDecision|null,
 *   checkResults?: import('../contracts/eligibility.js').EligibilityCheckResult[],
 *   evidence?: import('../contracts/eligibilityEvaluationEvidence.js').EligibilityEvaluationEvidence|null,
 *   auditEventId?: string|null,
 *   evaluatedAt?: string|null,
 *   evaluatorVersion?: string|null,
 *   replayed?: boolean,
 *   idempotencyResult?: 'MISS'|'HIT'|'CONFLICT'|null,
 *   warnings?: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[],
 *   metadata?: Record<string, unknown>|null,
 * }} fields
 * @returns {EligibilityEvaluationServiceResult}
 */
export function eligibilityEvaluationServiceOk(fields) {
  return {
    ok: true,
    operation: String(fields.operation),
    registrationId: fields.registrationId ?? fields.decision?.registrationId ?? null,
    decision: fields.decision ?? null,
    checkResults: Array.isArray(fields.checkResults)
      ? fields.checkResults.slice()
      : fields.decision?.checkResults?.slice() ?? [],
    evidence: fields.evidence ?? null,
    auditEventId: fields.auditEventId ?? null,
    evaluatedAt: fields.evaluatedAt ?? fields.decision?.evaluatedAt ?? null,
    evaluatorVersion: fields.evaluatorVersion ?? fields.decision?.evaluatorVersion ?? null,
    replayed: fields.replayed === true,
    idempotencyResult: fields.idempotencyResult ?? null,
    warnings: Array.isArray(fields.warnings) ? fields.warnings.slice() : [],
    ...(fields.metadata ? { metadata: { ...fields.metadata } } : {}),
  };
}

/**
 * @param {string} operation
 * @param {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} errors
 * @param {{
 *   registrationId?: string|null,
 *   decision?: import('../contracts/eligibility.js').EligibilityDecision|null,
 *   checkResults?: import('../contracts/eligibility.js').EligibilityCheckResult[],
 *   evidence?: import('../contracts/eligibilityEvaluationEvidence.js').EligibilityEvaluationEvidence|null,
 *   evaluatedAt?: string|null,
 *   evaluatorVersion?: string|null,
 *   replayed?: boolean,
 *   idempotencyResult?: 'MISS'|'HIT'|'CONFLICT'|null,
 *   warnings?: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[],
 *   metadata?: Record<string, unknown>|null,
 * }} [context]
 * @returns {EligibilityEvaluationServiceResult}
 */
export function eligibilityEvaluationServiceFail(operation, errors, context = {}) {
  return {
    ok: false,
    operation: String(operation),
    registrationId: context.registrationId ?? context.decision?.registrationId ?? null,
    decision: context.decision ?? null,
    checkResults: Array.isArray(context.checkResults)
      ? context.checkResults.slice()
      : context.decision?.checkResults?.slice() ?? [],
    evidence: context.evidence ?? null,
    auditEventId: null,
    evaluatedAt: context.evaluatedAt ?? null,
    evaluatorVersion: context.evaluatorVersion ?? null,
    replayed: context.replayed === true,
    idempotencyResult: context.idempotencyResult ?? null,
    warnings: Array.isArray(context.warnings) ? context.warnings.slice() : [],
    errors: Array.isArray(errors) ? errors.slice() : [],
    ...(context.metadata ? { metadata: { ...context.metadata } } : {}),
  };
}
