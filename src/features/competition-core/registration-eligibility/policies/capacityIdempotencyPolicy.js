import { createRegistrationIdempotencyRecord } from "../contracts/idempotency.js";
import { isNonEmptyString } from "../contracts/shared.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  registrationEligibilityError,
  registrationEligibilityFail,
  registrationEligibilityOk,
} from "../errors/registrationEligibilityError.js";

/** Namespaced prefixes — never reuse REG_IDEMP / EVAL_IDEMP. */
export const CAPACITY_IDEMPOTENCY_NAMESPACE = Object.freeze({
  RESERVE: "CAPACITY_RESERVE",
  RELEASE: "CAPACITY_RELEASE",
  WAITLIST_PLACE: "WAITLIST_PLACE",
  WAITLIST_WITHDRAW: "WAITLIST_WITHDRAW",
  WAITLIST_PROMOTE: "WAITLIST_PROMOTE",
});

/**
 * @param {string} namespace
 * @param {string} requestId
 * @returns {string}
 */
export function buildCapacityIdempotencyKey(namespace, requestId) {
  if (!isNonEmptyString(namespace)) {
    throw new TypeError("capacity idempotency namespace is required");
  }
  if (!isNonEmptyString(requestId)) {
    throw new TypeError("requestId is required for capacity idempotency");
  }
  return `${String(namespace).trim()}::${String(requestId).trim()}`;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function canonicalizeJsonValue(value) {
  if (value === null || typeof value !== "object") {
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(/** @type {Record<string, unknown>} */ (value)).sort()) {
    out[key] = canonicalizeJsonValue(/** @type {Record<string, unknown>} */ (value)[key]);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} parts
 * @returns {Record<string, unknown>}
 */
export function buildCanonicalCapacityRequestFingerprint(parts) {
  return Object.freeze(
    /** @type {Record<string, unknown>} */ (canonicalizeJsonValue(parts || {}))
  );
}

/**
 * @param {Record<string, unknown>} fingerprint
 * @returns {string}
 */
export function serializeCanonicalCapacityRequestFingerprint(fingerprint) {
  return JSON.stringify(canonicalizeJsonValue(fingerprint));
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>|null|undefined} b
 * @returns {boolean}
 */
export function canonicalCapacityFingerprintsEqual(a, b) {
  if (!b || typeof b !== "object") return false;
  return (
    serializeCanonicalCapacityRequestFingerprint(a) ===
    serializeCanonicalCapacityRequestFingerprint(b)
  );
}

/**
 * @typedef {Object} CapacityReplayPayload
 * @property {'CAPACITY_WAITLIST_REPLAY'} kind
 * @property {string} namespace
 * @property {Record<string, unknown>} canonicalFingerprint
 * @property {string} registrationId
 * @property {string|null} [reservationId]
 * @property {string|null} [waitlistEntryId]
 * @property {string|null} [auditEventId]
 * @property {string|null} [previousStatus]
 * @property {string|null} [currentStatus]
 * @property {import('../contracts/capacity.js').RegistrationCapacitySnapshot|null} [capacitySnapshot]
 * @property {import('../contracts/capacity.js').CapacityReservation|null} [reservation]
 * @property {import('../contracts/capacity.js').WaitlistEntry|null} [waitlistEntry]
 * @property {import('../contracts/capacity.js').RegistrationWaitlistPosition|null} [waitlistPosition]
 * @property {import('../contracts/competitionRegistration.js').CompetitionRegistration|null} [registration]
 * @property {number|null} [stateVersion]
 * @property {string} performedAt
 */

/**
 * @param {{
 *   requestId: string,
 *   namespace: string,
 *   registrationId: string,
 *   canonicalFingerprint: Record<string, unknown>,
 * }} request
 * @param {import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null|undefined} existing
 */
export function evaluateIdempotentCapacityRequest(request, existing) {
  if (!isNonEmptyString(request?.requestId)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "requestId",
        "requestId is required for capacity/waitlist idempotency"
      ),
    ]);
  }
  if (!isNonEmptyString(request?.namespace)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "namespace",
        "idempotency namespace is required"
      ),
    ]);
  }
  if (!isNonEmptyString(request?.registrationId)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "registrationId",
        "registrationId is required"
      ),
    ]);
  }
  if (!request?.canonicalFingerprint || typeof request.canonicalFingerprint !== "object") {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "canonicalFingerprint",
        "canonical capacity fingerprint is required"
      ),
    ]);
  }

  if (!existing) {
    return registrationEligibilityOk({
      kind: "MISS",
      replay: null,
      requestId: String(request.requestId).trim(),
    });
  }

  const fingerprint = existing.requestFingerprint;
  const replay =
    fingerprint &&
    typeof fingerprint === "object" &&
    /** @type {{ kind?: string }} */ (fingerprint).kind === "CAPACITY_WAITLIST_REPLAY"
      ? /** @type {CapacityReplayPayload} */ (fingerprint)
      : null;

  if (!replay) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT,
        "requestId",
        "Request id is bound to a non-capacity idempotency record",
        { requestId: request.requestId, namespace: request.namespace }
      ),
    ]);
  }

  if (replay.namespace !== request.namespace) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT,
        "requestId",
        "Request id is bound to a different capacity operation namespace",
        {
          requestId: request.requestId,
          expectedNamespace: request.namespace,
          existingNamespace: replay.namespace,
        }
      ),
    ]);
  }

  if (!canonicalCapacityFingerprintsEqual(request.canonicalFingerprint, replay.canonicalFingerprint)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT,
        "requestId",
        "Request id already bound to a different canonical capacity/waitlist request",
        {
          requestId: request.requestId,
          existingRegistrationId: replay.registrationId,
          registrationId: String(request.registrationId).trim(),
        }
      ),
    ]);
  }

  return registrationEligibilityOk({
    kind: "HIT",
    replay,
    requestId: String(request.requestId).trim(),
  });
}

/**
 * @param {{
 *   namespace: string,
 *   requestId: string,
 *   registrationId: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 *   createdAt: string,
 *   replay: CapacityReplayPayload,
 * }} input
 */
export function createIdempotencyRecordForCapacity(input) {
  const idempotencyKey = buildCapacityIdempotencyKey(input.namespace, input.requestId);
  return createRegistrationIdempotencyRecord({
    idempotencyKey,
    registrationId: input.registrationId,
    registrationRequestId: `capacity::${input.namespace}::${input.requestId}`,
    competitionId: input.competitionId,
    divisionId: input.divisionId ?? null,
    targetType: "CAPACITY_WAITLIST",
    targetStableIdentity: `${input.namespace}::${input.registrationId}`,
    createdAt: input.createdAt,
    requestFingerprint: input.replay,
  });
}
