import { isNonEmptyString, REGISTRATION_ELIGIBILITY_SCHEMA_VERSION } from "./shared.js";
import {
  assertRegistrationTarget,
  buildRegistrationTargetStableIdentity,
} from "./registrationTarget.js";

/**
 * Idempotency / duplicate-prevention request fingerprint.
 *
 * Recommended later-phase uniqueness (document only — not applied in Phase 1A):
 * - UNIQUE (idempotencyKey) WHERE idempotencyKey IS NOT NULL
 * - UNIQUE (competitionId, divisionId, target_stable_identity) WHERE status NOT IN terminal reopen-safe set
 * - UNIQUE (registrationRequestId)
 *
 * @typedef {Object} RegistrationIdempotencyKeyParts
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {import('./registrationTarget.js').RegistrationTarget} target
 * @property {string} [idempotencyKey]
 * @property {string} [registrationRequestId]
 */

/**
 * @typedef {Object} RegistrationIdempotencyRecord
 * @property {string} schemaVersion
 * @property {string} idempotencyKey
 * @property {string} registrationId
 * @property {string} registrationRequestId
 * @property {string} competitionId
 * @property {string|null} divisionId
 * @property {string} targetType
 * @property {string} targetStableIdentity
 * @property {string} createdAt
 * @property {Record<string, unknown>|null} [requestFingerprint]
 */

/**
 * Build a deterministic idempotency key when caller does not supply one.
 * Never uses random IDs.
 *
 * @param {RegistrationIdempotencyKeyParts} parts
 * @returns {string}
 */
export function buildRegistrationIdempotencyKey(parts) {
  if (isNonEmptyString(parts.idempotencyKey)) {
    return String(parts.idempotencyKey).trim();
  }
  if (!isNonEmptyString(parts.competitionId)) {
    throw new TypeError("idempotency key requires competitionId");
  }
  const target = assertRegistrationTarget(parts.target);
  const divisionId =
    parts.divisionId != null && String(parts.divisionId).trim() !== ""
      ? String(parts.divisionId).trim()
      : "NONE";
  const requestId = isNonEmptyString(parts.registrationRequestId)
    ? String(parts.registrationRequestId).trim()
    : "NO_REQUEST";
  return [
    "REG_IDEMP",
    String(parts.competitionId).trim(),
    divisionId,
    buildRegistrationTargetStableIdentity(target),
    requestId,
  ].join("::");
}

/**
 * @param {Partial<RegistrationIdempotencyRecord>} partial
 * @returns {RegistrationIdempotencyRecord}
 */
export function createRegistrationIdempotencyRecord(partial = {}) {
  if (!isNonEmptyString(partial.idempotencyKey)) {
    throw new TypeError("RegistrationIdempotencyRecord requires idempotencyKey");
  }
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("RegistrationIdempotencyRecord requires registrationId");
  }
  if (!isNonEmptyString(partial.registrationRequestId)) {
    throw new TypeError("RegistrationIdempotencyRecord requires registrationRequestId");
  }
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("RegistrationIdempotencyRecord requires competitionId");
  }
  if (!isNonEmptyString(partial.createdAt)) {
    throw new TypeError("RegistrationIdempotencyRecord requires createdAt from ClockPort");
  }
  if (!isNonEmptyString(partial.targetType)) {
    throw new TypeError("RegistrationIdempotencyRecord requires targetType");
  }
  if (!isNonEmptyString(partial.targetStableIdentity)) {
    throw new TypeError("RegistrationIdempotencyRecord requires targetStableIdentity");
  }

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    idempotencyKey: String(partial.idempotencyKey).trim(),
    registrationId: String(partial.registrationId).trim(),
    registrationRequestId: String(partial.registrationRequestId).trim(),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    targetType: String(partial.targetType).trim(),
    targetStableIdentity: String(partial.targetStableIdentity).trim(),
    createdAt: String(partial.createdAt).trim(),
    requestFingerprint:
      partial.requestFingerprint &&
      typeof partial.requestFingerprint === "object" &&
      !Array.isArray(partial.requestFingerprint)
        ? { ...partial.requestFingerprint }
        : null,
  });
}
