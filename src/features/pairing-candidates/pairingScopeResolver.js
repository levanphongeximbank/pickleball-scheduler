/**
 * Resolve tenant scope for pairing candidate discovery.
 * Never fall back to placeholder "default-tenant" — that falsely excludes
 * real Staging athletes as WRONG_SCOPE.
 */

import { DEFAULT_TENANT_ID, tenantIdFromRecord } from "../../models/tenant.js";
import { getExplicitTenantIdForClub } from "../tenant/guards/tenantGuard.js";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlaceholderTenantId(value) {
  const id = String(value || "").trim().toLowerCase();
  return !id || id === DEFAULT_TENANT_ID || id === "default" || id === "default-tenant";
}

/**
 * Prefer tournament / canonical club / explicit context. Never invent default-tenant.
 *
 * @param {{
 *   tournamentTenantId?: string|null,
 *   club?: object|null,
 *   clubId?: string|null,
 *   clubs?: Array<object>|null,
 *   currentTenantId?: string|null,
 * }} [input]
 * @returns {string|null}
 */
export function resolvePairingScopeTenantId(input = {}) {
  const clubId = String(input.clubId || "").trim();
  const fromClubs = Array.isArray(input.clubs)
    ? input.clubs.find((item) => String(item?.id || "").trim() === clubId)
    : null;

  const lazyCandidates = [
    () => input.tournamentTenantId,
    () => tenantIdFromRecord(input.club),
    () => tenantIdFromRecord(fromClubs),
    () => input.currentTenantId,
    () => {
      if (!clubId) return null;
      try {
        return getExplicitTenantIdForClub(clubId);
      } catch {
        return null;
      }
    },
  ];

  for (const read of lazyCandidates) {
    const id = String(read() || "").trim();
    if (id && !isPlaceholderTenantId(id)) {
      return id;
    }
  }

  return null;
}
