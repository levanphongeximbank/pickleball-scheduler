/**
 * Tenant + venue scope — mandatory on every CRM aggregate and command.
 * No silent defaults. No demo-club fallback.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function requireNonEmptyId(value, fieldName) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `${fieldName} is required and must be a non-empty string.`
    );
  }
  return id;
}

/**
 * @param {object} input
 * @returns {{ tenantId: string, venueId: string }}
 */
export function createTenantVenueScope(input = {}) {
  if (!input || typeof input !== "object") {
    throw new CrmError(CRM_ERROR_CODES.MISSING_SCOPE, "tenantId and venueId are required.");
  }
  const tenantId = typeof input.tenantId === "string" ? input.tenantId.trim() : "";
  const venueId = typeof input.venueId === "string" ? input.venueId.trim() : "";
  if (!tenantId || !venueId) {
    throw new CrmError(
      CRM_ERROR_CODES.MISSING_SCOPE,
      "tenantId and venueId are mandatory; no default scope is allowed."
    );
  }
  return Object.freeze({ tenantId, venueId });
}

/**
 * @param {{ tenantId?: string, venueId?: string }|null|undefined} left
 * @param {{ tenantId?: string, venueId?: string }|null|undefined} right
 * @returns {boolean}
 */
export function scopesEqual(left, right) {
  if (!left || !right) return false;
  return left.tenantId === right.tenantId && left.venueId === right.venueId;
}

/**
 * @param {{ tenantId: string, venueId: string }} scope
 * @param {{ tenantId: string, venueId: string }} resource
 */
export function assertSameScope(scope, resource) {
  if (!scopesEqual(scope, resource)) {
    throw new CrmError(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Cross-tenant or cross-venue CRM access is forbidden.",
      { scope, resourceScope: { tenantId: resource.tenantId, venueId: resource.venueId } }
    );
  }
}
