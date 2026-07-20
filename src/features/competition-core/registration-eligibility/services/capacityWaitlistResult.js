/**
 * CapacityWaitlistServiceResult — consistent operation outcome for Phase 1D.
 *
 * @typedef {Object} CapacityWaitlistServiceResult
 * @property {boolean} ok
 * @property {string} operation
 * @property {import('../contracts/competitionRegistration.js').CompetitionRegistration|null} registration
 * @property {import('../contracts/capacity.js').RegistrationCapacitySnapshot|null} capacitySnapshot
 * @property {import('../contracts/capacity.js').CapacityReservation|null} reservation
 * @property {import('../contracts/capacity.js').WaitlistEntry|null} waitlistEntry
 * @property {import('../contracts/capacity.js').RegistrationWaitlistPosition|null} waitlistPosition
 * @property {Array<Record<string, unknown>>|null} promotionCandidates
 * @property {string|null} previousStatus
 * @property {string|null} currentStatus
 * @property {number|null} stateVersion
 * @property {'MISS'|'HIT'|'CONFLICT'|null} idempotencyResult
 * @property {string|null} auditEventId
 * @property {string|null} performedAt
 * @property {boolean} replayed
 * @property {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} warnings
 * @property {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} [errors]
 * @property {Record<string, unknown>|null} [metadata]
 */

/**
 * @param {object} fields
 * @returns {CapacityWaitlistServiceResult}
 */
export function capacityWaitlistServiceOk(fields) {
  return {
    ok: true,
    operation: String(fields.operation),
    registration: fields.registration ?? null,
    capacitySnapshot: fields.capacitySnapshot ?? null,
    reservation: fields.reservation ?? null,
    waitlistEntry: fields.waitlistEntry ?? null,
    waitlistPosition: fields.waitlistPosition ?? null,
    promotionCandidates: Array.isArray(fields.promotionCandidates)
      ? fields.promotionCandidates.slice()
      : null,
    previousStatus: fields.previousStatus ?? fields.registration?.status ?? null,
    currentStatus: fields.currentStatus ?? fields.registration?.status ?? null,
    stateVersion:
      fields.stateVersion != null
        ? Number(fields.stateVersion)
        : fields.capacitySnapshot?.stateVersion ?? null,
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
 * @param {object} [context]
 * @returns {CapacityWaitlistServiceResult}
 */
export function capacityWaitlistServiceFail(operation, errors, context = {}) {
  return {
    ok: false,
    operation: String(operation),
    registration: context.registration ?? null,
    capacitySnapshot: context.capacitySnapshot ?? null,
    reservation: context.reservation ?? null,
    waitlistEntry: context.waitlistEntry ?? null,
    waitlistPosition: context.waitlistPosition ?? null,
    promotionCandidates: Array.isArray(context.promotionCandidates)
      ? context.promotionCandidates.slice()
      : null,
    previousStatus: context.previousStatus ?? context.registration?.status ?? null,
    currentStatus: context.currentStatus ?? context.registration?.status ?? null,
    stateVersion:
      context.stateVersion != null
        ? Number(context.stateVersion)
        : context.capacitySnapshot?.stateVersion ?? null,
    idempotencyResult: context.idempotencyResult ?? null,
    auditEventId: null,
    performedAt: context.performedAt ?? null,
    replayed: context.replayed === true,
    warnings: Array.isArray(context.warnings) ? context.warnings.slice() : [],
    errors: Array.isArray(errors) ? errors.slice() : [],
    ...(context.metadata ? { metadata: { ...context.metadata } } : {}),
  };
}
