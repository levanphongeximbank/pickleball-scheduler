import {
  AUTHORIZATION_ERROR_CODE,
  AuthorizationError,
} from "../errors/index.js";
import { createAuthorizationScope } from "./authorizationScope.js";
import { createAuthorizationSubject } from "./authorizationSubject.js";
import {
  freezeRecord,
  isPlainObject,
  normalizeStringList,
  optionalNonEmptyString,
} from "./shared.js";

/**
 * @typedef {Object} AuthorizationRequest
 * @property {string} action
 * @property {Readonly<import('./authorizationSubject.js').AuthorizationSubject>} subject
 * @property {Readonly<import('./authorizationScope.js').AuthorizationScope>} scope
 * @property {string[]} [requiredPermissions]
 * @property {string|null} [resourceType]
 * @property {string|null} [resourceId]
 * @property {Readonly<Record<string, unknown>>} [context]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<AuthorizationRequest>}
 */
export function createAuthorizationRequest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationRequest must be a plain object",
      {}
    );
  }
  const action = optionalNonEmptyString(partial.action);
  if (!action) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationRequest.action is required",
      {}
    );
  }
  return Object.freeze({
    action,
    subject: createAuthorizationSubject(partial.subject || {}),
    scope: createAuthorizationScope(partial.scope || {}),
    requiredPermissions: Object.freeze(
      normalizeStringList(partial.requiredPermissions)
    ),
    resourceType: optionalNonEmptyString(partial.resourceType),
    resourceId: optionalNonEmptyString(partial.resourceId),
    context: freezeRecord(partial.context),
    metadata: freezeRecord(partial.metadata),
  });
}
