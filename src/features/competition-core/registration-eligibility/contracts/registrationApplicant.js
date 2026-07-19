import { createAuditMetadata, isNonEmptyString, REGISTRATION_ELIGIBILITY_SCHEMA_VERSION } from "./shared.js";

/**
 * RegistrationApplicant — person or agent submitting the application.
 *
 * @typedef {Object} RegistrationApplicant
 * @property {string} schemaVersion
 * @property {string|null} platformUserId
 * @property {string|null} participantId
 * @property {string|null} displayName
 * @property {string|null} contactEmail
 * @property {string|null} clubId
 * @property {Record<string, unknown>|null} [metadata]
 * @property {import('./shared.js').RegistrationAuditMetadata} [audit]
 */

/**
 * @param {Partial<RegistrationApplicant>} partial
 * @returns {RegistrationApplicant}
 */
export function createRegistrationApplicant(partial = {}) {
  const platformUserId =
    partial.platformUserId != null && String(partial.platformUserId).trim() !== ""
      ? String(partial.platformUserId).trim()
      : null;
  const participantId =
    partial.participantId != null && String(partial.participantId).trim() !== ""
      ? String(partial.participantId).trim()
      : null;

  if (!isNonEmptyString(platformUserId) && !isNonEmptyString(participantId)) {
    throw new TypeError(
      "RegistrationApplicant requires platformUserId or participantId (fail closed)"
    );
  }

  return {
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    platformUserId,
    participantId,
    displayName:
      partial.displayName != null && String(partial.displayName).trim() !== ""
        ? String(partial.displayName).trim()
        : null,
    contactEmail:
      partial.contactEmail != null && String(partial.contactEmail).trim() !== ""
        ? String(partial.contactEmail).trim()
        : null,
    clubId:
      partial.clubId != null && String(partial.clubId).trim() !== ""
        ? String(partial.clubId).trim()
        : null,
    metadata:
      partial.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : null,
    audit: createAuditMetadata(partial.audit),
  };
}
