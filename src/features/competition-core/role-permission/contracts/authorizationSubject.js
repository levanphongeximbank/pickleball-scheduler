import { normalizeCompetitionRole } from "../enums/competitionRoles.js";
import {
  AUTHORIZATION_ERROR_CODE,
  AuthorizationError,
} from "../errors/index.js";
import {
  freezeRecord,
  isPlainObject,
  optionalNonEmptyString,
} from "./shared.js";

/**
 * @typedef {Object} AuthorizationSubject
 * @property {string|null} actorId
 * @property {string} role
 * @property {string|null} [displayName]
 * @property {Readonly<Record<string, unknown>>} [attributes]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<AuthorizationSubject>}
 */
export function createAuthorizationSubject(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationSubject must be a plain object",
      {}
    );
  }
  return Object.freeze({
    actorId: optionalNonEmptyString(partial.actorId ?? partial.actor),
    role: normalizeCompetitionRole(partial.role ?? partial.actorRole),
    displayName: optionalNonEmptyString(partial.displayName),
    attributes: freezeRecord(partial.attributes),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAuthorizationSubject(value) {
  return (
    isPlainObject(value) &&
    (value.actorId == null || typeof value.actorId === "string") &&
    typeof value.role === "string"
  );
}
