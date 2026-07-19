import {
  REGISTRATION_STATUS,
  isRegistrationStatus,
  isTerminalRegistrationStatus,
} from "../enums/registrationStatus.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  registrationEligibilityError,
  registrationEligibilityFail,
  registrationEligibilityOk,
} from "../errors/registrationEligibilityError.js";

/**
 * Allowed registration status transitions (fail closed).
 * Terminal statuses have empty allow-lists — no silent reopen.
 */
export const REGISTRATION_ALLOWED_TRANSITIONS = Object.freeze({
  [REGISTRATION_STATUS.DRAFT]: Object.freeze([
    REGISTRATION_STATUS.SUBMITTED,
    REGISTRATION_STATUS.WITHDRAWN,
    REGISTRATION_STATUS.CANCELLED,
  ]),
  [REGISTRATION_STATUS.SUBMITTED]: Object.freeze([
    REGISTRATION_STATUS.UNDER_REVIEW,
    REGISTRATION_STATUS.WITHDRAWN,
    REGISTRATION_STATUS.CANCELLED,
    REGISTRATION_STATUS.EXPIRED,
  ]),
  [REGISTRATION_STATUS.UNDER_REVIEW]: Object.freeze([
    REGISTRATION_STATUS.APPROVED,
    REGISTRATION_STATUS.CONDITIONAL,
    REGISTRATION_STATUS.WAITLISTED,
    REGISTRATION_STATUS.REJECTED,
    REGISTRATION_STATUS.WITHDRAWN,
    REGISTRATION_STATUS.CANCELLED,
    REGISTRATION_STATUS.EXPIRED,
  ]),
  [REGISTRATION_STATUS.CONDITIONAL]: Object.freeze([
    REGISTRATION_STATUS.APPROVED,
    REGISTRATION_STATUS.REJECTED,
    REGISTRATION_STATUS.WITHDRAWN,
    REGISTRATION_STATUS.CANCELLED,
    REGISTRATION_STATUS.EXPIRED,
  ]),
  [REGISTRATION_STATUS.WAITLISTED]: Object.freeze([
    REGISTRATION_STATUS.APPROVED,
    REGISTRATION_STATUS.WITHDRAWN,
    REGISTRATION_STATUS.CANCELLED,
    REGISTRATION_STATUS.EXPIRED,
    REGISTRATION_STATUS.REJECTED,
  ]),
  [REGISTRATION_STATUS.APPROVED]: Object.freeze([]),
  [REGISTRATION_STATUS.REJECTED]: Object.freeze([]),
  [REGISTRATION_STATUS.WITHDRAWN]: Object.freeze([]),
  [REGISTRATION_STATUS.CANCELLED]: Object.freeze([]),
  [REGISTRATION_STATUS.EXPIRED]: Object.freeze([]),
});

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransitionRegistrationStatus(from, to) {
  if (!isRegistrationStatus(from) || !isRegistrationStatus(to)) {
    return false;
  }
  if (from === to) {
    return true;
  }
  if (isTerminalRegistrationStatus(from)) {
    return false;
  }
  const allowed = REGISTRATION_ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * Fail-closed transition validation.
 *
 * @param {string} from
 * @param {string} to
 * @returns {import('../errors/registrationEligibilityError.js').RegistrationEligibilityResult}
 */
export function validateRegistrationTransition(from, to) {
  if (!isRegistrationStatus(from) || !isRegistrationStatus(to)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_STATUS,
        "status",
        "Invalid registration status for transition",
        { from, to }
      ),
    ]);
  }

  if (from === to) {
    return registrationEligibilityOk({ from, to, noop: true });
  }

  if (isTerminalRegistrationStatus(from)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.TERMINAL_STATUS,
        "status",
        `Terminal status ${from} cannot transition to ${to}`,
        { from, to }
      ),
    ]);
  }

  const allowed = REGISTRATION_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TRANSITION,
        "status",
        `Invalid registration transition ${from} → ${to}`,
        { from, to, allowed: [...allowed] }
      ),
    ]);
  }

  return registrationEligibilityOk({ from, to, noop: false });
}

/**
 * Apply a validated status transition (pure). Caller must validate first.
 *
 * @param {import('../contracts/competitionRegistration.js').CompetitionRegistration} registration
 * @param {string} toStatus
 * @param {{
 *   decidedAt?: string|null,
 *   decidedBy?: string|null,
 *   reason?: string|null,
 *   clockNow?: string|null,
 * }} [meta]
 * @returns {import('../contracts/competitionRegistration.js').CompetitionRegistration}
 */
export function applyRegistrationTransition(registration, toStatus, meta = {}) {
  const result = validateRegistrationTransition(registration.status, toStatus);
  if (!result.ok) {
    const first = result.errors[0];
    throw new TypeError(first?.message || "Invalid registration transition");
  }

  const now =
    meta.clockNow != null && String(meta.clockNow).trim() !== ""
      ? String(meta.clockNow).trim()
      : meta.decidedAt != null && String(meta.decidedAt).trim() !== ""
        ? String(meta.decidedAt).trim()
        : null;

  const next = {
    ...registration,
    status: toStatus,
    audit: {
      ...registration.audit,
      updatedAt: now ?? registration.audit?.updatedAt ?? null,
      updatedBy: meta.decidedBy ?? registration.audit?.updatedBy ?? null,
      decidedAt:
        toStatus === REGISTRATION_STATUS.APPROVED ||
        toStatus === REGISTRATION_STATUS.REJECTED ||
        toStatus === REGISTRATION_STATUS.CONDITIONAL ||
        toStatus === REGISTRATION_STATUS.WAITLISTED
          ? meta.decidedAt ?? now ?? registration.audit?.decidedAt ?? null
          : registration.audit?.decidedAt ?? null,
      decidedBy:
        meta.decidedBy ?? registration.audit?.decidedBy ?? null,
      reason: meta.reason ?? registration.audit?.reason ?? null,
    },
  };

  if (toStatus === REGISTRATION_STATUS.SUBMITTED && !next.submittedAt) {
    next.submittedAt = now;
  }
  if (
    toStatus === REGISTRATION_STATUS.APPROVED ||
    toStatus === REGISTRATION_STATUS.REJECTED ||
    toStatus === REGISTRATION_STATUS.CONDITIONAL ||
    toStatus === REGISTRATION_STATUS.WAITLISTED
  ) {
    next.decidedAt = meta.decidedAt ?? now ?? next.decidedAt;
    next.decidedBy = meta.decidedBy ?? next.decidedBy;
  }

  return next;
}
