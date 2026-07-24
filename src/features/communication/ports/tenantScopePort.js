/**
 * TenantScopePort — opaque tenant / organization scope (COMMS-01).
 * Does not own tenant lifecycle.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} TenantScopePort
 * @property {(tenantId: string) => Promise<object|null>} resolveTenantScope
 * @property {(authUserId: string, tenantId: string) => Promise<boolean>} canAccessTenant
 */

export const TENANT_SCOPE_PORT_METHODS = Object.freeze([
  "resolveTenantScope",
  "canAccessTenant",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesTenantScopePort(port) {
  return matchesPortMethods(port, TENANT_SCOPE_PORT_METHODS);
}

/**
 * @returns {TenantScopePort}
 */
export function createUnimplementedTenantScopePort() {
  return {
    async resolveTenantScope() {
      throwPortUnimplemented("TenantScopePort", "resolveTenantScope");
    },
    async canAccessTenant() {
      throwPortUnimplemented("TenantScopePort", "canAccessTenant");
    },
  };
}
