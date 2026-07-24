/**
 * Branding identity helpers (CM-05).
 */

import { isNonEmptyString, deepFreeze } from "./shared.js";

/**
 * Deterministic branding identity for one competition under a tenant.
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function createCompetitionBrandingId(tenantId, competitionId) {
  return `cb::${String(tenantId).trim()}::${String(competitionId).trim()}`;
}

/**
 * @param {string} brandingId
 * @returns {{ tenantId: string, competitionId: string } | null}
 */
export function parseCompetitionBrandingId(brandingId) {
  if (!isNonEmptyString(brandingId)) return null;
  const parts = String(brandingId).trim().split("::");
  if (parts.length !== 3 || parts[0] !== "cb") return null;
  if (!isNonEmptyString(parts[1]) || !isNonEmptyString(parts[2])) return null;
  return deepFreeze({
    tenantId: parts[1],
    competitionId: parts[2],
  });
}

/**
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function brandingScopeKey(tenantId, competitionId) {
  return `${String(tenantId).trim()}::${String(competitionId).trim()}`;
}
