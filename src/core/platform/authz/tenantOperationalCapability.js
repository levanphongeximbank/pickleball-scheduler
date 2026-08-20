/**
 * Wave 4 architecture amendment:
 * tenant_members is Tenant OPERATIONAL entitlement, not universal account membership.
 *
 * Platform Core keeps this classifier neutral. Identity permissions are imported
 * as string constants only — no Business Module reverse dependency.
 */

import { PERMISSIONS } from "../../../auth/permissions.js";
import { ROLES, isClubScopedRole, isGlobalRole, normalizeRole } from "../../../auth/roles.js";

const TENANT_OPERATIONAL_PERMISSIONS = new Set([
  PERMISSIONS.TENANT_ROLE_CUSTOMIZE,
  PERMISSIONS.BILLING_TENANT_LOCK,
  PERMISSIONS.BILLING_TENANT_UNLOCK,
]);

const NON_TENANT_OPERATIONAL_ROLES = new Set([
  ROLES.PLAYER,
  ROLES.REFEREE,
  ROLES.COACH,
  ROLES.CLUB_MANAGER,
  ROLES.CUSTOMER,
  ROLES.TEAM_CAPTAIN,
]);

export function requiresTenantOperationalEntitlement(permission) {
  return TENANT_OPERATIONAL_PERMISSIONS.has(permission);
}

export function isNonTenantOperationalDomainRole(role) {
  const canonical = normalizeRole(role);
  if (!canonical) {
    return false;
  }
  if (isGlobalRole(canonical)) {
    return false;
  }
  return NON_TENANT_OPERATIONAL_ROLES.has(canonical) || isClubScopedRole(canonical);
}

export function listTenantOperationalPermissions() {
  return [...TENANT_OPERATIONAL_PERMISSIONS];
}
