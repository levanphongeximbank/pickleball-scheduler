/**
 * Phase 20 — Routes exempt from tenant operational lock (billing/support/profile).
 */

const BILLING_EXEMPT_EXACT = new Set(["/profile", "/403"]);

const BILLING_EXEMPT_PREFIXES = [
  "/billing",
  "/profile/",
];

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
