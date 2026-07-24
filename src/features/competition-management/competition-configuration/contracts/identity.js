/**
 * Configuration identity helpers (CM-04).
 */

import { isNonEmptyString, deepFreeze } from "./shared.js";

/**
 * Deterministic configuration identity for one competition under a tenant.
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function createCompetitionConfigurationId(tenantId, competitionId) {
  return `cc::${String(tenantId).trim()}::${String(competitionId).trim()}`;
}

/**
 * @param {string} configurationId
 * @returns {{ tenantId: string, competitionId: string } | null}
 */
export function parseCompetitionConfigurationId(configurationId) {
  if (!isNonEmptyString(configurationId)) return null;
  const parts = String(configurationId).trim().split("::");
  if (parts.length !== 3 || parts[0] !== "cc") return null;
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
export function configurationScopeKey(tenantId, competitionId) {
  return `${String(tenantId).trim()}::${String(competitionId).trim()}`;
}
