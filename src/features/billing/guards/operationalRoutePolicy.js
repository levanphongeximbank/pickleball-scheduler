/**
 * Phase 20 — Routes exempt from tenant operational lock (billing/support/profile).
 */

import {
  ROLES,
  isGlobalRole,
  isPlatformScopedRole,
  normalizeRole,
} from "../../../auth/roles.js";

const BILLING_EXEMPT_EXACT = new Set(["/profile", "/403"]);

const BILLING_EXEMPT_PREFIXES = [
  "/billing",
  "/profile/",
  "/mobile/player",
  "/mobile/notifications",
];

/** Vai trò cuối (VĐV/khách/đội trưởng) — không bị khóa bởi gói thuê của tenant. */
export function isSubscriptionOperationalExemptRole(user) {
  if (!user?.role) {
    return false;
  }

  if (isGlobalRole(user.role) || isPlatformScopedRole(user.role)) {
    return true;
  }

  const role = normalizeRole(user.role);
  return (
    role === ROLES.PLAYER ||
    role === ROLES.CUSTOMER ||
    role === ROLES.TEAM_CAPTAIN
  );
}

/** Paths that remain accessible when tenant subscription is locked. */
export function isBillingExemptPath(pathname) {
  if (!pathname) {
    return false;
  }

  if (BILLING_EXEMPT_EXACT.has(pathname)) {
    return true;
  }

  return BILLING_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}`)
  );
}

/** Default operational action checked for route lock. */
export const DEFAULT_OPERATIONAL_ACTION = "create_booking";
