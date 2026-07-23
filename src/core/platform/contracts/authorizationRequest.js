/**
 * Authorization Request contract (Platform Core Phase 1F–1J).
 *
 * Technical request envelope for an authorization check already framed by an
 * external caller. Does not evaluate roles, actions, policy, ownership, or
 * resolve tenants.
 */

import { fail, ok } from "./result.js";
import { createPermissionCode } from "./permissionCode.js";
import { isSecurityContext } from "./securityContext.js";
import { isPlatformScope } from "./platformScope.js";
import { isSubjectReference } from "./subjectReference.js";

/**
 * @typedef {{
 *   securityContext: import("./securityContext.js").SecurityContext,
 *   permissionCode: string,
 *   scope?: import("./platformScope.js").PlatformScope,
 *   subject?: import("./subjectReference.js").SubjectReference,
 * }} AuthorizationRequest
 */

export const AUTHORIZATION_REQUEST_ERROR = Object.freeze({
  INVALID: "AUTHORIZATION_REQUEST_INVALID",
  SECURITY_CONTEXT_INVALID: "AUTHORIZATION_REQUEST_SECURITY_CONTEXT_INVALID",
  PERMISSION_CODE_INVALID: "AUTHORIZATION_REQUEST_PERMISSION_CODE_INVALID",
  SCOPE_INVALID: "AUTHORIZATION_REQUEST_SCOPE_INVALID",
  SUBJECT_INVALID: "AUTHORIZATION_REQUEST_SUBJECT_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function authorizationRequestError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createAuthorizationRequest(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      authorizationRequestError(
        AUTHORIZATION_REQUEST_ERROR.INVALID,
        "AuthorizationRequest input must be a plain object"
      )
    );
  }

  if (
    !("securityContext" in input) ||
    input.securityContext === undefined ||
    !isSecurityContext(input.securityContext)
  ) {
    return fail(
      authorizationRequestError(
        AUTHORIZATION_REQUEST_ERROR.SECURITY_CONTEXT_INVALID,
        "AuthorizationRequest securityContext must be a valid SecurityContext",
        "securityContext"
      )
    );
  }

  if (!("permissionCode" in input) || input.permissionCode === undefined) {
    return fail(
      authorizationRequestError(
        AUTHORIZATION_REQUEST_ERROR.PERMISSION_CODE_INVALID,
        "AuthorizationRequest permissionCode is required",
        "permissionCode"
      )
    );
  }

  const permissionCodeResult = createPermissionCode(input.permissionCode);
  if (!permissionCodeResult.ok) {
    return fail(
      authorizationRequestError(
        AUTHORIZATION_REQUEST_ERROR.PERMISSION_CODE_INVALID,
        "AuthorizationRequest permissionCode must be a valid PermissionCode",
        "permissionCode"
      )
    );
  }

  /** @type {AuthorizationRequest} */
  const request = {
    // Preserve caller reference; do not clone nested securityContext.
    securityContext: input.securityContext,
    permissionCode: permissionCodeResult.value,
  };

  if ("scope" in input && input.scope !== undefined) {
    if (!isPlatformScope(input.scope)) {
      return fail(
        authorizationRequestError(
          AUTHORIZATION_REQUEST_ERROR.SCOPE_INVALID,
          "AuthorizationRequest scope must be a valid PlatformScope",
          "scope"
        )
      );
    }
    request.scope = input.scope;
  }

  if ("subject" in input && input.subject !== undefined) {
    if (!isSubjectReference(input.subject)) {
      return fail(
        authorizationRequestError(
          AUTHORIZATION_REQUEST_ERROR.SUBJECT_INVALID,
          "AuthorizationRequest subject must be a valid SubjectReference",
          "subject"
        )
      );
    }
    request.subject = input.subject;
  }

  return ok(Object.freeze(request));
}

/**
 * @param {*} value
 * @returns {value is AuthorizationRequest}
 */
export function isAuthorizationRequest(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!isSecurityContext(value.securityContext)) {
    return false;
  }
  if (typeof value.permissionCode !== "string") {
    return false;
  }
  return createAuthorizationRequest(value).ok === true;
}
