/**
 * Phase 1B resolution / profile result builders.
 * Normal outcomes are result objects — not thrown errors.
 */

import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";

/**
 * @typedef {object} PlayerResolutionResult
 * @property {boolean} ok
 * @property {string} outcome
 * @property {string|null} playerId
 * @property {string|null} authUserId
 * @property {string[]} candidatePlayerIds
 * @property {string[]} warnings
 * @property {Record<string, unknown>} meta
 * @property {object|null} [profile]
 * @property {string|null} [code] operational error code when ok=false for non-outcome errors
 * @property {string|null} [message]
 */

/**
 * @param {object} params
 * @param {string} params.outcome
 * @param {string|null} [params.playerId]
 * @param {string|null} [params.authUserId]
 * @param {string[]} [params.candidatePlayerIds]
 * @param {string[]} [params.warnings]
 * @param {Record<string, unknown>} [params.meta]
 * @param {object|null} [params.profile]
 * @returns {PlayerResolutionResult}
 */
export function buildResolutionResult({
  outcome,
  playerId = null,
  authUserId = null,
  candidatePlayerIds = [],
  warnings = [],
  meta = {},
  profile = undefined,
}) {
  const selectable =
    outcome === RESOLUTION_OUTCOME.MAPPED || outcome === RESOLUTION_OUTCOME.DERIVED;

  const result = {
    ok: true,
    outcome,
    playerId: playerId ? String(playerId) : null,
    authUserId: authUserId ? String(authUserId) : null,
    candidatePlayerIds: [...new Set(candidatePlayerIds.map((id) => String(id).trim()).filter(Boolean))],
    warnings: [...warnings],
    meta: {
      selectable,
      ...meta,
    },
  };

  if (profile !== undefined) {
    result.profile = profile;
  }

  return result;
}

/**
 * Operational failure (not an identity outcome).
 * @param {object} params
 * @param {string} params.code
 * @param {string} [params.message]
 * @param {Record<string, unknown>} [params.meta]
 * @returns {PlayerResolutionResult}
 */
export function buildOperationalError({ code, message, meta = {} }) {
  return {
    ok: false,
    outcome: RESOLUTION_OUTCOME.INVALID,
    playerId: null,
    authUserId: null,
    candidatePlayerIds: [],
    warnings: [],
    code,
    message: message || code,
    meta,
  };
}
