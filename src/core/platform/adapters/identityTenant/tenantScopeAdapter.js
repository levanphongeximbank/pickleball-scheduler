/**
 * Tenant Scope Adapter — projects already-resolved tenant scope values into
 * Platform Core PlatformScope.
 *
 * Does not evaluate membership, look up tenants, or equate tenantId with
 * venueId automatically.
 */

import { fail } from "../../contracts/result.js";
import { createPlatformScope } from "../../contracts/platformScope.js";

export const TENANT_SCOPE_ADAPTER_ERROR = Object.freeze({
  INVALID: "TENANT_SCOPE_ADAPTER_INVALID",
  SCOPE_TYPE_REQUIRED: "TENANT_SCOPE_ADAPTER_SCOPE_TYPE_REQUIRED",
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
 * Project explicit scope framing into PlatformScope.
 *
 * Requires explicit scopeType. Optional scopeId and tenantId are passed
 * through only when provided — venueId is never inferred as tenantId.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectTenantScope(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        TENANT_SCOPE_ADAPTER_ERROR.INVALID,
        "Tenant scope input must be a plain object"
      )
    );
  }

  if (typeof input.scopeType !== "string" || input.scopeType.trim().length === 0) {
    return fail(
      adapterError(
        TENANT_SCOPE_ADAPTER_ERROR.SCOPE_TYPE_REQUIRED,
        "Tenant scope projection requires an explicit scopeType",
        "scopeType"
      )
    );
  }

  /** @type {{ scopeType: string, scopeId?: *, tenantId?: * }} */
  const payload = { scopeType: input.scopeType };

  if ("scopeId" in input && input.scopeId !== undefined) {
    payload.scopeId = input.scopeId;
  }
  if ("tenantId" in input && input.tenantId !== undefined) {
    payload.tenantId = input.tenantId;
  }

  return createPlatformScope(payload);
}
