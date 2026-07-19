import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  registrationEligibilityError,
  registrationEligibilityFail,
  registrationEligibilityOk,
} from "../errors/registrationEligibilityError.js";
import {
  buildRegistrationIdempotencyKey,
  createRegistrationIdempotencyRecord,
} from "../contracts/idempotency.js";
import { buildRegistrationTargetStableIdentity } from "../contracts/registrationTarget.js";
import { isNonEmptyString } from "../contracts/shared.js";

/**
 * @typedef {Object} IdempotencyLookupResult
 * @property {'MISS'|'HIT'|'CONFLICT'} kind
 * @property {import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null} [record]
 * @property {string|null} [registrationId]
 */

/**
 * Compare a new submission against an existing idempotency record.
 * Same key + same fingerprint → HIT (return existing; do not create duplicate).
 * Same key + different fingerprint → CONFLICT (fail closed).
 *
 * @param {{
 *   idempotencyKey: string,
 *   registrationRequestId: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 *   target: import('../contracts/registrationTarget.js').RegistrationTarget,
 *   requestFingerprint?: Record<string, unknown>|null,
 * }} request
 * @param {import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null|undefined} existing
 * @returns {import('../errors/registrationEligibilityError.js').RegistrationEligibilityResult}
 */
export function evaluateIdempotentSubmission(request, existing) {
  if (!isNonEmptyString(request?.idempotencyKey)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "idempotencyKey",
        "idempotencyKey is required for duplicate-safe submission"
      ),
    ]);
  }
  if (!isNonEmptyString(request?.competitionId)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "competitionId",
        "competitionId is required"
      ),
    ]);
  }
  if (!isNonEmptyString(request?.registrationRequestId)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "registrationRequestId",
        "registrationRequestId is required"
      ),
    ]);
  }
  if (!request?.target) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TARGET,
        "target",
        "target is required"
      ),
    ]);
  }

  if (!existing) {
    return registrationEligibilityOk({
      kind: "MISS",
      record: null,
      registrationId: null,
      idempotencyKey: String(request.idempotencyKey).trim(),
    });
  }

  const targetStable = buildRegistrationTargetStableIdentity(request.target);
  const divisionId =
    request.divisionId != null && String(request.divisionId).trim() !== ""
      ? String(request.divisionId).trim()
      : null;

  const sameScope =
    existing.competitionId === String(request.competitionId).trim() &&
    (existing.divisionId ?? null) === divisionId &&
    existing.targetStableIdentity === targetStable &&
    existing.registrationRequestId === String(request.registrationRequestId).trim();

  const fingerprintMatches =
    JSON.stringify(existing.requestFingerprint ?? null) ===
    JSON.stringify(request.requestFingerprint ?? null);

  if (sameScope && fingerprintMatches) {
    return registrationEligibilityOk({
      kind: "HIT",
      record: existing,
      registrationId: existing.registrationId,
      idempotencyKey: existing.idempotencyKey,
    });
  }

  return registrationEligibilityFail([
    registrationEligibilityError(
      REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT,
      "idempotencyKey",
      "Idempotency key already bound to a different registration request",
      {
        idempotencyKey: existing.idempotencyKey,
        existingRegistrationId: existing.registrationId,
      }
    ),
  ]);
}

/**
 * Pure helper to mint an idempotency record after a MISS (caller supplies ids + clock).
 *
 * @param {{
 *   registrationId: string,
 *   createdAt: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 *   target: import('../contracts/registrationTarget.js').RegistrationTarget,
 *   registrationRequestId: string,
 *   idempotencyKey?: string|null,
 *   requestFingerprint?: Record<string, unknown>|null,
 * }} input
 * @returns {import('../contracts/idempotency.js').RegistrationIdempotencyRecord}
 */
export function createIdempotencyRecordForRegistration(input) {
  const idempotencyKey = buildRegistrationIdempotencyKey({
    competitionId: input.competitionId,
    divisionId: input.divisionId,
    target: input.target,
    registrationRequestId: input.registrationRequestId,
    idempotencyKey: input.idempotencyKey || undefined,
  });

  return createRegistrationIdempotencyRecord({
    idempotencyKey,
    registrationId: input.registrationId,
    registrationRequestId: input.registrationRequestId,
    competitionId: input.competitionId,
    divisionId: input.divisionId ?? null,
    targetType: input.target.targetType,
    targetStableIdentity: buildRegistrationTargetStableIdentity(input.target),
    createdAt: input.createdAt,
    requestFingerprint: input.requestFingerprint ?? null,
  });
}

export { buildRegistrationIdempotencyKey };
