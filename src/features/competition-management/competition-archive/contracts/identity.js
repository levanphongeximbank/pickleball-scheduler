/**
 * Archive identity helpers (CM-08).
 */

import { isNonEmptyString, deepFreeze } from "./shared.js";

/**
 * Deterministic archive record identity.
 * Format: carch::{tenantId}::{competitionId}::{revision}
 *
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {number} revision
 * @returns {string}
 */
export function createCompetitionArchiveRecordId(
  tenantId,
  competitionId,
  revision
) {
  const tid = String(tenantId).trim();
  const cid = String(competitionId).trim();
  const rev = Number(revision);
  return `carch::${tid}::${cid}::${rev}`;
}

/**
 * @param {unknown} recordId
 * @returns {{ tenantId: string, competitionId: string, revision: number } | null}
 */
export function parseCompetitionArchiveRecordId(recordId) {
  if (!isNonEmptyString(recordId)) return null;
  const raw = String(recordId).trim();
  const match = /^carch::([^:]+)::([^:]+)::(\d+)$/.exec(raw);
  if (!match) return null;
  const revision = Number(match[3]);
  if (!Number.isInteger(revision) || revision < 1) return null;
  return deepFreeze({
    tenantId: match[1],
    competitionId: match[2],
    revision,
  });
}

/**
 * Scope key for tenant + competition archive lineage.
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function archiveScopeKey(tenantId, competitionId) {
  return `${String(tenantId).trim()}::${String(competitionId).trim()}`;
}

/**
 * Idempotency storage key scoped to tenant + competition.
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {string} idempotencyKey
 * @returns {string}
 */
export function createArchiveIdempotencyStorageKey(
  tenantId,
  competitionId,
  idempotencyKey
) {
  return `idem::${String(tenantId).trim()}::${String(competitionId).trim()}::${String(
    idempotencyKey
  ).trim()}`;
}
