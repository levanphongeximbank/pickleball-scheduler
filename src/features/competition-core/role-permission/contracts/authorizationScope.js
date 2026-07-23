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
 * @typedef {Object} AuthorizationScope
 * @property {string|null} [tenantId]
 * @property {string|null} [venueId]
 * @property {string|null} [clubId]
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {string|null} [teamId]
 * @property {string|null} [matchId]
 * @property {Readonly<Record<string, unknown>>} [attributes]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<AuthorizationScope>}
 */
export function createAuthorizationScope(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationScope must be a plain object",
      {}
    );
  }
  const competitionId = optionalNonEmptyString(partial.competitionId);
  if (!competitionId) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationScope.competitionId is required",
      {}
    );
  }
  return Object.freeze({
    tenantId: optionalNonEmptyString(partial.tenantId),
    venueId: optionalNonEmptyString(partial.venueId),
    clubId: optionalNonEmptyString(partial.clubId),
    competitionId,
    divisionId: optionalNonEmptyString(partial.divisionId),
    teamId: optionalNonEmptyString(partial.teamId),
    matchId: optionalNonEmptyString(partial.matchId),
    attributes: freezeRecord(partial.attributes),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAuthorizationScope(value) {
  return (
    isPlainObject(value) &&
    typeof value.competitionId === "string" &&
    value.competitionId.trim() !== ""
  );
}
