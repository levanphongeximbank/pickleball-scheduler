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
 * @typedef {Object} AuthorizationExplanation
 * @property {string} summary
 * @property {string[]} requiredPermissions
 * @property {string[]} matchedPermissions
 * @property {string[]} grantedPermissions
 * @property {string|null} [denyReason]
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<AuthorizationExplanation>}
 */
export function createAuthorizationExplanation(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationExplanation must be a plain object",
      {}
    );
  }
  return Object.freeze({
    summary: optionalNonEmptyString(partial.summary) || "",
    requiredPermissions: Object.freeze(
      normalizeStringList(partial.requiredPermissions)
    ),
    matchedPermissions: Object.freeze(
      normalizeStringList(partial.matchedPermissions)
    ),
    grantedPermissions: Object.freeze(
      normalizeStringList(partial.grantedPermissions)
    ),
    denyReason: optionalNonEmptyString(partial.denyReason),
    details: freezeRecord(partial.details),
  });
}
