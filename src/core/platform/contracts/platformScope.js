/**
 * Platform Scope contract (Platform Core Phase 1E).
 *
 * Technical representation of an operation/decision scope provided by an
 * external runtime. Does not evaluate authorization, resolve hierarchy,
 * load tenant/venue/club/competition data, or invent identifiers.
 */

import { fail, ok } from "./result.js";
import { normalizeOpaqueId } from "./opaqueId.js";

/**
 * @typedef {{
 *   scopeType: string,
 *   scopeId?: string,
 *   tenantId?: string,
 * }} PlatformScope
 */

export const PLATFORM_SCOPE_ERROR = Object.freeze({
  INVALID: "PLATFORM_SCOPE_INVALID",
  TYPE_INVALID: "PLATFORM_SCOPE_TYPE_INVALID",
  ID_INVALID: "PLATFORM_SCOPE_ID_INVALID",
  TENANT_ID_INVALID: "PLATFORM_SCOPE_TENANT_ID_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function platformScopeError(code, message, field) {
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
export function createPlatformScope(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      platformScopeError(
        PLATFORM_SCOPE_ERROR.INVALID,
        "PlatformScope input must be a plain object"
      )
    );
  }

  if (typeof input.scopeType !== "string") {
    return fail(
      platformScopeError(
        PLATFORM_SCOPE_ERROR.TYPE_INVALID,
        "PlatformScope scopeType must be a string",
        "scopeType"
      )
    );
  }

  const scopeType = input.scopeType.trim();
  if (scopeType.length === 0) {
    return fail(
      platformScopeError(
        PLATFORM_SCOPE_ERROR.TYPE_INVALID,
        "PlatformScope scopeType must be a non-empty string",
        "scopeType"
      )
    );
  }

  /** @type {PlatformScope} */
  const scope = { scopeType };

  if ("scopeId" in input && input.scopeId !== undefined) {
    const scopeIdResult = normalizeOpaqueId(input.scopeId);
    if (!scopeIdResult.ok) {
      return fail(
        platformScopeError(
          PLATFORM_SCOPE_ERROR.ID_INVALID,
          "PlatformScope scopeId must be a non-empty opaque identifier",
          "scopeId"
        )
      );
    }
    scope.scopeId = scopeIdResult.value;
  }

  if ("tenantId" in input && input.tenantId !== undefined) {
    const tenantIdResult = normalizeOpaqueId(input.tenantId);
    if (!tenantIdResult.ok) {
      return fail(
        platformScopeError(
          PLATFORM_SCOPE_ERROR.TENANT_ID_INVALID,
          "PlatformScope tenantId must be a non-empty opaque identifier",
          "tenantId"
        )
      );
    }
    scope.tenantId = tenantIdResult.value;
  }

  return ok(Object.freeze(scope));
}

/**
 * @param {*} value
 * @returns {value is PlatformScope}
 */
export function isPlatformScope(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (typeof value.scopeType !== "string") {
    return false;
  }
  return createPlatformScope(value).ok === true;
}
