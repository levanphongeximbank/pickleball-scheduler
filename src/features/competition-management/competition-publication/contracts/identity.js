/**
 * Publication identity helpers (CM-06).
 */

import { isNonEmptyString, deepFreeze } from "./shared.js";
import { isCompetitionPublicationChannel } from "../constants/channels.js";

/**
 * Deterministic publication identity for one tenant+competition+channel+revision.
 * Format: cpub::{tenantId}::{competitionId}::{channel}::{revision}
 *
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {string} channel
 * @param {number} revision
 * @returns {string}
 */
export function createCompetitionPublicationId(
  tenantId,
  competitionId,
  channel,
  revision
) {
  const tid = String(tenantId).trim();
  const cid = String(competitionId).trim();
  const ch = String(channel).trim();
  const rev = Number(revision);
  return `cpub::${tid}::${cid}::${ch}::${rev}`;
}

/**
 * @param {unknown} publicationId
 * @returns {{ tenantId: string, competitionId: string, channel: string, revision: number } | null}
 */
export function parseCompetitionPublicationId(publicationId) {
  if (!isNonEmptyString(publicationId)) return null;
  const raw = String(publicationId).trim();
  const match = /^cpub::([^:]+)::([^:]+)::([^:]+)::(\d+)$/.exec(raw);
  if (!match) return null;
  const channel = match[3];
  const revision = Number(match[4]);
  if (!isCompetitionPublicationChannel(channel)) return null;
  if (!Number.isInteger(revision) || revision < 1) return null;
  return deepFreeze({
    tenantId: match[1],
    competitionId: match[2],
    channel,
    revision,
  });
}

/**
 * Scope key for tenant + competition + channel (publication lineage scope).
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {string} channel
 * @returns {string}
 */
export function publicationScopeKey(tenantId, competitionId, channel) {
  return `${String(tenantId).trim()}::${String(competitionId).trim()}::${String(channel).trim()}`;
}

/**
 * Idempotency storage key scoped to tenant + competition + channel.
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {string} channel
 * @param {string} idempotencyKey
 * @returns {string}
 */
export function createIdempotencyStorageKey(
  tenantId,
  competitionId,
  channel,
  idempotencyKey
) {
  return `idem::${String(tenantId).trim()}::${String(competitionId).trim()}::${String(
    channel
  ).trim()}::${String(idempotencyKey).trim()}`;
}

/**
 * Public reference reservation key (unique per tenant, independent of channel).
 * @param {string} tenantId
 * @param {string} slug
 * @returns {string}
 */
export function publicReferenceKey(tenantId, slug) {
  return `${String(tenantId).trim()}::${String(slug).trim()}`;
}
