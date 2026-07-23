/**
 * Scope equality for history/snapshot queries (Phase 1D).
 */

import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";

/**
 * @param {import('../contracts/scopeContract.js').PlayerRatingScope} a
 * @param {import('../contracts/scopeContract.js').PlayerRatingScope} b
 * @returns {boolean}
 */
export function scopesMatch(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "global") return true;
  if (a.tenantId !== b.tenantId) return false;
  const venueA = a.venueId == null ? null : String(a.venueId);
  const venueB = b.venueId == null ? null : String(b.venueId);
  return venueA === venueB;
}

/**
 * Normalize query scope (fail-closed).
 * @param {unknown} scopeOrTenantId
 * @returns {import('../contracts/scopeContract.js').PlayerRatingScope}
 */
export function requireQueryScope(scopeOrTenantId) {
  return requireExplicitPlayerRatingScope(scopeOrTenantId);
}
