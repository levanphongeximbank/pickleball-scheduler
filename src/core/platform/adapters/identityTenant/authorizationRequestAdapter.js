/**
 * Authorization Request Adapter — combines already-resolved SecurityContext,
 * PermissionCode, and optional scope/subject into AuthorizationRequest.
 *
 * Does not evaluate permissions, look up resources, or assign permissions.
 */

import { fail, ok } from "../../contracts/result.js";
import { createAuthorizationRequest } from "../../contracts/authorizationRequest.js";
import { isSecurityContext } from "../../contracts/securityContext.js";
import { isPlatformScope } from "../../contracts/platformScope.js";
import { isSubjectReference } from "../../contracts/subjectReference.js";
import { projectSecurityContext } from "./securityContextAdapter.js";
import { projectPermissionCode } from "./permissionCodeAdapter.js";
import { projectTenantScope } from "./tenantScopeAdapter.js";

export const AUTHORIZATION_REQUEST_ADAPTER_ERROR = Object.freeze({
  INVALID: "AUTHORIZATION_REQUEST_ADAPTER_INVALID",
  SECURITY_CONTEXT_REQUIRED:
    "AUTHORIZATION_REQUEST_ADAPTER_SECURITY_CONTEXT_REQUIRED",
  PERMISSION_REQUIRED: "AUTHORIZATION_REQUEST_ADAPTER_PERMISSION_REQUIRED",
  SCOPE_INVALID: "AUTHORIZATION_REQUEST_ADAPTER_SCOPE_INVALID",
  SUBJECT_INVALID: "AUTHORIZATION_REQUEST_ADAPTER_SUBJECT_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolveSecurityContext(input) {
  if (!("securityContext" in input) || input.securityContext === undefined) {
    return fail(
      adapterError(
        AUTHORIZATION_REQUEST_ADAPTER_ERROR.SECURITY_CONTEXT_REQUIRED,
        "Authorization request projection requires securityContext",
        "securityContext"
      )
    );
  }

  if (isSecurityContext(input.securityContext)) {
    return ok(input.securityContext);
  }

  return projectSecurityContext(input.securityContext);
}

/**
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolvePermissionCode(input) {
  if (!("permissionCode" in input) || input.permissionCode === undefined) {
    if (!("permission" in input) || input.permission === undefined) {
      return fail(
        adapterError(
          AUTHORIZATION_REQUEST_ADAPTER_ERROR.PERMISSION_REQUIRED,
          "Authorization request projection requires permissionCode",
          "permissionCode"
        )
      );
    }
    return projectPermissionCode(input.permission);
  }
  return projectPermissionCode(input.permissionCode);
}

/**
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolveOptionalScope(input) {
  if (!("scope" in input) || input.scope === undefined) {
    return ok(undefined);
  }

  if (isPlatformScope(input.scope)) {
    return ok(input.scope);
  }

  const projected = projectTenantScope(input.scope);
  if (!projected.ok) {
    return fail(
      adapterError(
        AUTHORIZATION_REQUEST_ADAPTER_ERROR.SCOPE_INVALID,
        "Authorization request scope must be a valid PlatformScope",
        "scope"
      )
    );
  }
  return projected;
}

/**
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolveOptionalSubject(input) {
  if (!("subject" in input) || input.subject === undefined) {
    return ok(undefined);
  }

  if (!isSubjectReference(input.subject)) {
    return fail(
      adapterError(
        AUTHORIZATION_REQUEST_ADAPTER_ERROR.SUBJECT_INVALID,
        "Authorization request subject must be a valid SubjectReference",
        "subject"
      )
    );
  }

  return ok(input.subject);
}

/**
 * Compose an AuthorizationRequest from already-framed inputs.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectAuthorizationRequest(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        AUTHORIZATION_REQUEST_ADAPTER_ERROR.INVALID,
        "Authorization request input must be a plain object"
      )
    );
  }

  const securityContextResult = resolveSecurityContext(input);
  if (!securityContextResult.ok) return securityContextResult;

  const permissionCodeResult = resolvePermissionCode(input);
  if (!permissionCodeResult.ok) return permissionCodeResult;

  const scopeResult = resolveOptionalScope(input);
  if (!scopeResult.ok) return scopeResult;

  const subjectResult = resolveOptionalSubject(input);
  if (!subjectResult.ok) return subjectResult;

  /** @type {{ securityContext: *, permissionCode: *, scope?: *, subject?: * }} */
  const payload = {
    securityContext: securityContextResult.value,
    permissionCode: permissionCodeResult.value,
  };

  if (scopeResult.value !== undefined) {
    payload.scope = scopeResult.value;
  }
  if (subjectResult.value !== undefined) {
    payload.subject = subjectResult.value;
  }

  return createAuthorizationRequest(payload);
}
