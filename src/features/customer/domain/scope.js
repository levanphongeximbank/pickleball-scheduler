/**
 * Tenant + venue scope for Customer Management.
 * Aligns with CRM VenueCustomerDirectoryPort scope shape.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { requireOpaqueId } from "./identifiers.js";

/**
 * @param {object} input
 * @returns {Readonly<{ tenantId: string, venueId: string }>}
 */
export function createCustomerScope(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MISSING_SCOPE,
      "Customer scope must be a plain object with tenantId and venueId."
    );
  }
  const tenantId = requireOpaqueId(input.tenantId, "tenantId");
  const venueId = requireOpaqueId(input.venueId, "venueId");
  return Object.freeze({ tenantId, venueId });
}

/**
 * @param {object} scope
 * @param {object} entity
 * @returns {boolean}
 */
export function scopesMatch(scope, entity) {
  return (
    scope &&
    entity &&
    scope.tenantId === entity.tenantId &&
    scope.venueId === entity.venueId
  );
}

/**
 * @param {object} scope
 * @param {object} entity
 * @param {string} [label]
 */
export function assertScopeOwnership(scope, entity, label = "Customer") {
  if (!scopesMatch(scope, entity)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.TENANT_SCOPE_MISMATCH,
      `${label} does not belong to the requested tenant/venue scope.`,
      {
        tenantId: scope?.tenantId,
        venueId: scope?.venueId,
        entityTenantId: entity?.tenantId,
        entityVenueId: entity?.venueId,
      }
    );
  }
}
