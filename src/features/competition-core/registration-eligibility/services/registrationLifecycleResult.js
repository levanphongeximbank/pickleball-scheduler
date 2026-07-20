/**
 * RegistrationLifecycleServiceResult — consistent operation outcome for Phase 1B.
 *
 * @typedef {Object} RegistrationLifecycleServiceResult
 * @property {boolean} ok
 * @property {string} operation
 * @property {import('../contracts/competitionRegistration.js').CompetitionRegistration|null} registration
 * @property {string|null} previousStatus
 * @property {string|null} currentStatus
 * @property {'MISS'|'HIT'|'CONFLICT'|null} idempotencyResult
 * @property {string|null} auditEventId
 * @property {string|null} performedAt
 * @property {boolean} replayed
 * @property {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} warnings
 * @property {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} [errors]
 * @property {Record<string, unknown>|null} [metadata]
 */

/**
 * @param {{
 *   operation: string,
 *   registration?: import('../contracts/competitionRegistration.js').CompetitionRegistration|null,
 *   previousStatus?: string|null,
 *   currentStatus?: string|null,
 *   idempotencyResult?: 'MISS'|'HIT'|'CONFLICT'|null,
 *   auditEventId?: string|null,
 *   performedAt?: string|null,
 *   replayed?: boolean,
 *   warnings?: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[],
 *   metadata?: Record<string, unknown>|null,
 * }} fields
 * @returns {RegistrationLifecycleServiceResult}
 */
export function registrationLifecycleServiceOk(fields) {
  return {
    ok: true,
    operation: String(fields.operation),
    registration: fields.registration ?? null,
    previousStatus: fields.previousStatus ?? fields.registration?.status ?? null,
    currentStatus: fields.currentStatus ?? fields.registration?.status ?? null,
    idempotencyResult: fields.idempotencyResult ?? null,
    auditEventId: fields.auditEventId ?? null,
    performedAt: fields.performedAt ?? null,
    replayed: fields.replayed === true,
    warnings: Array.isArray(fields.warnings) ? fields.warnings.slice() : [],
    ...(fields.metadata ? { metadata: { ...fields.metadata } } : {}),
  };
}

/**
 * @param {string} operation
 * @param {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} errors
 * @param {{
 *   registration?: import('../contracts/competitionRegistration.js').CompetitionRegistration|null,
 *   previousStatus?: string|null,
 *   currentStatus?: string|null,
 *   idempotencyResult?: 'MISS'|'HIT'|'CONFLICT'|null,
 *   performedAt?: string|null,
 *   replayed?: boolean,
 *   warnings?: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[],
 *   metadata?: Record<string, unknown>|null,
 * }} [context]
 * @returns {RegistrationLifecycleServiceResult}
 */
export function registrationLifecycleServiceFail(operation, errors, context = {}) {
  return {
    ok: false,
    operation: String(operation),
    registration: context.registration ?? null,
    previousStatus: context.previousStatus ?? context.registration?.status ?? null,
    currentStatus: context.currentStatus ?? context.registration?.status ?? null,
    idempotencyResult: context.idempotencyResult ?? null,
    auditEventId: null,
    performedAt: context.performedAt ?? null,
    replayed: context.replayed === true,
    warnings: Array.isArray(context.warnings) ? context.warnings.slice() : [],
    errors: Array.isArray(errors) ? errors.slice() : [],
    ...(context.metadata ? { metadata: { ...context.metadata } } : {}),
  };
}
