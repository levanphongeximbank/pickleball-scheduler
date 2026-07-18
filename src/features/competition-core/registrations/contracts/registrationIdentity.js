/**
 * Phase 3C — deterministic registration identity.
 * Key = competitionId::registrationKind::stableSourceIdentity
 * No timestamp. No random UUID. No display-name.
 */

import { PARTICIPANT_SCHEMA_VERSION, isNonEmptyString } from "../../participants/contracts/shared.js";
import { isRegistrationKind } from "../enums/registrationKinds.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";

/**
 * @typedef {Object} RegistrationIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} registrationKind
 * @property {string} stableSourceIdentity
 * @property {string} key
 */

/**
 * @param {{ competitionId?: string, registrationKind?: string, stableSourceIdentity?: string }} parts
 * @returns {string}
 */
export function buildRegistrationIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const registrationKind = String(parts.registrationKind || "").trim();
  const stableSourceIdentity = String(parts.stableSourceIdentity || "").trim();
  return `${competitionId}::${registrationKind}::${stableSourceIdentity}`;
}

/**
 * @param {Partial<RegistrationIdentity>} partial
 * @returns {RegistrationIdentity}
 */
export function createRegistrationIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const registrationKind = String(partial.registrationKind || "").trim();
  const stableSourceIdentity = String(partial.stableSourceIdentity || "").trim();

  if (!isNonEmptyString(competitionId)) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "RegistrationIdentity requires competitionId",
      {}
    );
  }
  if (!isRegistrationKind(registrationKind)) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_KIND,
      "RegistrationIdentity requires supported registrationKind",
      { registrationKind }
    );
  }
  if (!isNonEmptyString(stableSourceIdentity)) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "RegistrationIdentity requires stableSourceIdentity",
      { competitionId, registrationKind }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildRegistrationIdentityKey({
          competitionId,
          registrationKind,
          stableSourceIdentity,
        });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    registrationKind,
    stableSourceIdentity,
    key,
  });
}

/**
 * @param {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration|null|undefined} registration
 * @returns {RegistrationIdentity|null}
 */
export function identityFromCompetitionRegistration(registration) {
  if (!registration || typeof registration !== "object") return null;
  if (
    !isNonEmptyString(registration.competitionId) ||
    !isRegistrationKind(registration.registrationKind) ||
    !isNonEmptyString(registration.sourceId)
  ) {
    return null;
  }
  return createRegistrationIdentity({
    competitionId: registration.competitionId,
    registrationKind: registration.registrationKind,
    stableSourceIdentity: registration.sourceId,
    key: registration.identityKey || undefined,
  });
}
