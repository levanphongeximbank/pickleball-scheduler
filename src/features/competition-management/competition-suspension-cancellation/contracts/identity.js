/**
 * Lifecycle identity helpers (CM-07).
 */

import { isNonEmptyString, deepFreeze } from "./shared.js";

/**
 * Deterministic lifecycle record identity.
 * Format: clife::{tenantId}::{competitionId}::{revision}
 *
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {number} revision
 * @returns {string}
 */
export function createCompetitionLifecycleRecordId(
  tenantId,
  competitionId,
  revision
) {
  const tid = String(tenantId).trim();
  const cid = String(competitionId).trim();
  const rev = Number(revision);
  return `clife::${tid}::${cid}::${rev}`;
}

/**
 * @param {unknown} recordId
 * @returns {{ tenantId: string, competitionId: string, revision: number } | null}
 */
export function parseCompetitionLifecycleRecordId(recordId) {
  if (!isNonEmptyString(recordId)) return null;
  const raw = String(recordId).trim();
  const match = /^clife::([^:]+)::([^:]+)::(\d+)$/.exec(raw);
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
 * Scope key for tenant + competition lifecycle lineage.
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function lifecycleScopeKey(tenantId, competitionId) {
  return `${String(tenantId).trim()}::${String(competitionId).trim()}`;
}

/**
 * Idempotency storage key scoped to tenant + competition.
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {string} idempotencyKey
 * @returns {string}
 */
export function createLifecycleIdempotencyStorageKey(
  tenantId,
  competitionId,
  idempotencyKey
) {
  return `idem::${String(tenantId).trim()}::${String(competitionId).trim()}::${String(
    idempotencyKey
  ).trim()}`;
}
