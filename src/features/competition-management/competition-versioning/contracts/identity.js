/**
 * CompetitionVersion identity helpers (CM-03).
 *
 * Version identity is explicit, tenant/competition scoped, and deterministic.
 * Does not use wall-clock or uncontrolled random as the sole identity.
 */

import { deepFreeze, isNonEmptyString, isPositiveInteger } from "./shared.js";
import { COMPETITION_VERSION_INITIAL_NUMBER } from "../constants/versioning.js";

/**
 * Build a stable opaque CompetitionVersionId.
 * Format: cv::{tenantId}::{competitionId}::v{versionNumber}
 *
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {number} versionNumber
 * @returns {string}
 */
export function createCompetitionVersionId(
  tenantId,
  competitionId,
  versionNumber
) {
  const tid = String(tenantId).trim();
  const cid = String(competitionId).trim();
  const n = Number(versionNumber);
  return `cv::${tid}::${cid}::v${n}`;
}

/**
 * Parse a CompetitionVersionId produced by createCompetitionVersionId.
 * Fail-closed: returns null when format does not match.
 *
 * @param {unknown} versionId
 * @returns {{ tenantId: string, competitionId: string, versionNumber: number } | null}
 */
export function parseCompetitionVersionId(versionId) {
  if (!isNonEmptyString(versionId)) return null;
  const raw = String(versionId).trim();
  const match = /^cv::([^:]+)::([^:]+)::v(\d+)$/.exec(raw);
  if (!match) return null;
  const versionNumber = Number(match[3]);
  if (!isPositiveInteger(versionNumber)) return null;
  return deepFreeze({
    tenantId: match[1],
    competitionId: match[2],
    versionNumber,
  });
}

/**
 * Idempotency storage key scoped to tenant + competition.
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {string} idempotencyKey
 * @returns {string}
 */
export function createIdempotencyStorageKey(
  tenantId,
  competitionId,
  idempotencyKey
) {
  return `idem::${String(tenantId).trim()}::${String(competitionId).trim()}::${String(idempotencyKey).trim()}`;
}

/**
 * @param {number} [versionNumber]
 * @returns {boolean}
 */
export function isRootVersionNumber(versionNumber = COMPETITION_VERSION_INITIAL_NUMBER) {
  return versionNumber === COMPETITION_VERSION_INITIAL_NUMBER;
}
