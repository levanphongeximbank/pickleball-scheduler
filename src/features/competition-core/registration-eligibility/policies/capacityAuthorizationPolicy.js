import { isNonEmptyString } from "../contracts/shared.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  registrationEligibilityError,
} from "../errors/registrationEligibilityError.js";
import { hasAvailableCapacity } from "./capacityAccounting.js";

/** Structured authorization purposes for capacity/waitlist mutations. */
export const CAPACITY_AUTH_PURPOSE = Object.freeze({
  WAITLIST_PLACEMENT: "WAITLIST_PLACEMENT",
  WAITLIST_PROMOTION: "WAITLIST_PROMOTION",
});

/**
 * @typedef {Object} CapacityScopeAuthorization
 * @property {string} purpose
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {string} authorizedBy
 * @property {string} authorizationRef
 * @property {string} reason
 * @property {string|null} [issuedAt]
 * @property {string|null} [authorizationVersion]
 */

/**
 * Reject bare boolean flags and unbound authorizations.
 *
 * @param {unknown} authorization
 * @param {{
 *   expectedPurpose: string,
 *   registrationId: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 *   fieldPath?: string,
 *   errorCode?: string,
 * }} expected
 * @returns {{ ok: true, value: CapacityScopeAuthorization } | { ok: false, errors: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[] }}
 */
export function validateScopeBoundAuthorization(authorization, expected) {
  const fieldPath = expected.fieldPath || "authorization";
  const errorCode =
    expected.errorCode || REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION;

  if (authorization === true || authorization === false) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          errorCode,
          fieldPath,
          "Bare boolean authorization flags are rejected; supply a scope-bound authorization object"
        ),
      ],
    };
  }

  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          errorCode,
          fieldPath,
          "Structured scope-bound authorization is required"
        ),
      ],
    };
  }

  const auth = /** @type {Record<string, unknown>} */ (authorization);

  if (typeof auth.approved === "boolean" || typeof auth.forceWaitlist === "boolean") {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          errorCode,
          `${fieldPath}.approved`,
          "Unverified boolean flags are rejected; supply purpose-bound authorization fields"
        ),
      ],
    };
  }

  const requiredStringFields = [
    "purpose",
    "registrationId",
    "competitionId",
    "authorizedBy",
    "authorizationRef",
    "reason",
  ];
  for (const key of requiredStringFields) {
    if (!isNonEmptyString(auth[key])) {
      return {
        ok: false,
        errors: [
          registrationEligibilityError(
            errorCode,
            `${fieldPath}.${key}`,
            `${key} is required on scope-bound authorization`
          ),
        ],
      };
    }
  }

  const purpose = String(auth.purpose).trim();
  if (purpose !== expected.expectedPurpose) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          errorCode,
          `${fieldPath}.purpose`,
          `Authorization purpose must be ${expected.expectedPurpose}`,
          { purpose, expectedPurpose: expected.expectedPurpose }
        ),
      ],
    };
  }

  const registrationId = String(auth.registrationId).trim();
  if (registrationId !== String(expected.registrationId).trim()) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          errorCode,
          `${fieldPath}.registrationId`,
          "Authorization registrationId does not match the target registration",
          { authorizationRegistrationId: registrationId, registrationId: expected.registrationId }
        ),
      ],
    };
  }

  const competitionId = String(auth.competitionId).trim();
  if (competitionId !== String(expected.competitionId).trim()) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          errorCode,
          `${fieldPath}.competitionId`,
          "Authorization competitionId does not match the target competition",
          { authorizationCompetitionId: competitionId, competitionId: expected.competitionId }
        ),
      ],
    };
  }

  const authDivisionId =
    auth.divisionId != null && String(auth.divisionId).trim() !== ""
      ? String(auth.divisionId).trim()
      : null;
  const expectedDivisionId =
    expected.divisionId != null && String(expected.divisionId).trim() !== ""
      ? String(expected.divisionId).trim()
      : null;
  if (authDivisionId !== expectedDivisionId) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          errorCode,
          `${fieldPath}.divisionId`,
          "Authorization divisionId does not match the target division scope",
          { authorizationDivisionId: authDivisionId, divisionId: expectedDivisionId }
        ),
      ],
    };
  }

  return {
    ok: true,
    value: {
      purpose,
      registrationId,
      competitionId,
      divisionId: authDivisionId,
      authorizedBy: String(auth.authorizedBy).trim(),
      authorizationRef: String(auth.authorizationRef).trim(),
      reason: String(auth.reason).trim(),
      issuedAt:
        auth.issuedAt != null && String(auth.issuedAt).trim() !== ""
          ? String(auth.issuedAt).trim()
          : null,
      authorizationVersion:
        auth.authorizationVersion != null && String(auth.authorizationVersion).trim() !== ""
          ? String(auth.authorizationVersion).trim()
          : null,
    },
  };
}

/**
 * Policy explicitly requires waitlisting when requireWaitlist is true
 * (or legacy alias waitlistRequired). allowWaitlist alone is insufficient.
 *
 * @param {Record<string, unknown>|null|undefined} policy
 * @returns {boolean}
 */
export function policyExplicitlyRequiresWaitlist(policy) {
  if (!policy || typeof policy !== "object") return false;
  if (policy.policyAvailable === false) return false;
  return policy.requireWaitlist === true || policy.waitlistRequired === true;
}

/**
 * Decide whether waitlist placement is permitted when capacity remains.
 *
 * @param {{
 *   effectiveRemaining: number|null,
 *   competitionPolicy?: Record<string, unknown>|null,
 *   waitlistAuthorization?: unknown,
 *   forceWaitlist?: unknown,
 *   registrationId: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 * }} input
 * @returns {{
 *   ok: true,
 *   basis: 'CAPACITY_EXHAUSTED'|'POLICY_REQUIRED'|'SCOPE_AUTHORIZATION',
 *   authorization?: CapacityScopeAuthorization|null,
 * } | {
 *   ok: false,
 *   errors: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[],
 * }}
 */
export function resolveWaitlistPlacementPermit(input) {
  if (typeof input.forceWaitlist === "boolean") {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_WAITLIST_TRANSITION,
          "forceWaitlist",
          "Bare forceWaitlist boolean is rejected; use exhausted capacity, policy requireWaitlist, or scope-bound waitlistAuthorization",
          { forceWaitlist: input.forceWaitlist }
        ),
      ],
    };
  }

  if (!hasAvailableCapacity(input.effectiveRemaining)) {
    return { ok: true, basis: "CAPACITY_EXHAUSTED", authorization: null };
  }

  if (policyExplicitlyRequiresWaitlist(input.competitionPolicy)) {
    return { ok: true, basis: "POLICY_REQUIRED", authorization: null };
  }

  if (input.waitlistAuthorization != null) {
    const validated = validateScopeBoundAuthorization(input.waitlistAuthorization, {
      expectedPurpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PLACEMENT,
      registrationId: input.registrationId,
      competitionId: input.competitionId,
      divisionId: input.divisionId ?? null,
      fieldPath: "waitlistAuthorization",
      errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_WAITLIST_TRANSITION,
    });
    if (!validated.ok) return validated;
    return { ok: true, basis: "SCOPE_AUTHORIZATION", authorization: validated.value };
  }

  return {
    ok: false,
    errors: [
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_WAITLIST_TRANSITION,
        "capacity",
        "Capacity remains available; waitlist placement requires exhausted capacity, policy requireWaitlist, or scope-bound waitlistAuthorization",
        { effectiveRemaining: input.effectiveRemaining }
      ),
    ],
  };
}

/**
 * @param {unknown} approvalAuthorization
 * @param {{
 *   registrationId: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 * }} expected
 */
export function validatePromotionAuthorization(approvalAuthorization, expected) {
  return validateScopeBoundAuthorization(approvalAuthorization, {
    expectedPurpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PROMOTION,
    registrationId: expected.registrationId,
    competitionId: expected.competitionId,
    divisionId: expected.divisionId ?? null,
    fieldPath: "approvalAuthorization",
    errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION,
  });
}
