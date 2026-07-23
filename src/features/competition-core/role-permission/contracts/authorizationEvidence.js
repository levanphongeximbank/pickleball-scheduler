import {
  AUTHORIZATION_ERROR_CODE,
  AuthorizationError,
} from "../errors/index.js";
import {
  freezeRecord,
  isPlainObject,
  normalizeStringList,
  optionalNonEmptyString,
} from "./shared.js";

/**
 * @typedef {Object} AuthorizationEvidence
 * @property {string|null} [source]
 * @property {string|null} [subjectId]
 * @property {string|null} [role]
 * @property {string[]} grantedPermissions
 * @property {string|null} [tenantId]
 * @property {string|null} [venueId]
 * @property {string|null} [competitionId]
 * @property {string|null} [evidenceVersion]
 * @property {Readonly<Record<string, unknown>>} [attributes]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<AuthorizationEvidence>}
 */
export function createAuthorizationEvidence(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationEvidence must be a plain object",
      {}
    );
  }
  return Object.freeze({
    source: optionalNonEmptyString(partial.source) || "UNKNOWN",
    subjectId: optionalNonEmptyString(partial.subjectId),
    role: optionalNonEmptyString(partial.role),
    grantedPermissions: Object.freeze(
      normalizeStringList(partial.grantedPermissions)
    ),
    tenantId: optionalNonEmptyString(partial.tenantId),
    venueId: optionalNonEmptyString(partial.venueId),
    competitionId: optionalNonEmptyString(partial.competitionId),
    evidenceVersion: optionalNonEmptyString(partial.evidenceVersion),
    attributes: freezeRecord(partial.attributes),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAuthorizationEvidence(value) {
  return isPlainObject(value) && Array.isArray(value.grantedPermissions);
}
