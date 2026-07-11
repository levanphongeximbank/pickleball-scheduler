import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isRatingV2Enabled } from "../config/featureFlags.js";
import { buildCompetitionEloUpdatesFromMatchRecord } from "./competitionEloEngine.js";
import { RATING_ENGINE_VERSION } from "./ratingConstants.js";

/**
 * @typedef {Object} RatingDatabaseApplyResult
 * @property {boolean} ok
 * @property {boolean} [skipped]
 * @property {string|null} [reason]
 * @property {boolean} [idempotent]
 * @property {Array} [updates]
 * @property {string} [backend]
 * @property {string} [error]
 */

/**
 * @param {Object} [options]
 * @returns {boolean}
 */
export function shouldPreferDatabaseRating(options = {}) {
  if (options.ratingApplyBackend === "blob") {
    return false;
  }
  if (options.ratingApplyBackend === "database") {
    return true;
  }
  if (options.preferDatabaseRating === false) {
    return false;
  }
  return isRatingV2Enabled(options.envSource) && options.useDatabaseRating !== false;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient|null|undefined} supabase
 * @param {Object} params
 * @param {string} params.matchId
 * @param {string|null|undefined} params.tenantId
 * @param {string|null|undefined} params.tournamentId
 * @param {Array} params.updates
 * @param {Object} [options]
 * @returns {Promise<RatingDatabaseApplyResult>}
 */
export async function applyMatchRatingViaRpc(supabase, params, options = {}) {
  if (!supabase) {
    return { ok: false, error: "missing-supabase-client", backend: "database" };
  }

  const payload = {
    p_match_id: String(params.matchId),
    p_tenant_id: params.tenantId ?? null,
    p_tournament_id: params.tournamentId ?? null,
    p_updates: (params.updates || []).map((update) => ({
      playerId: String(update.playerId),
      previousRating: Number(update.previousRating),
      nextRating: Number(update.nextRating),
      delta: Number(update.delta ?? update.nextRating - update.previousRating),
    })),
    p_engine_version: options.engineVersion || RATING_ENGINE_VERSION,
  };

  const { data, error } = await supabase.rpc("competition_core_apply_match_rating_v2", payload);

  if (error) {
    return {
      ok: false,
      error: error.message || String(error),
      backend: "database",
    };
  }

  const result = data && typeof data === "object" ? data : {};
  return {
    ok: result.ok !== false,
    skipped: Boolean(result.skipped),
    reason: result.reason ?? null,
    idempotent: Boolean(result.idempotent),
    updates: params.updates || [],
    backend: "database",
    applied: result.applied ?? null,
  };
}

/**
 * Sync adapter for tests and controlled callers with pre-resolved RPC result.
 *
 * @param {Object|null|undefined} supabase
 * @param {Object} params
 * @param {Object} options
 * @returns {RatingDatabaseApplyResult|Promise<RatingDatabaseApplyResult>}
 */
export function applyMatchRatingViaConfiguredBackend(supabase, params, options = {}) {
  if (typeof options.applyDatabaseRating === "function") {
    return options.applyDatabaseRating(params, options);
  }

  if (options.ratingDatabaseResult) {
    return options.ratingDatabaseResult;
  }

  if (supabase && typeof supabase.rpc === "function") {
    return applyMatchRatingViaRpc(supabase, params, options);
  }

  return { ok: false, error: "database-backend-unavailable", backend: "database" };
}

/**
 * @param {Object} record
 * @param {Object[]} players
 * @param {Object} options
 * @returns {{ matchId: string, tenantId: string|null, tournamentId: string|null, updates: Array }}
 */
export function buildDatabaseRatingRpcParams(record, players, options = {}) {
  return {
    matchId: String(record.id),
    tenantId: options.tenantId ?? record.tenantId ?? options.clubId ?? null,
    tournamentId: record.tournamentId ?? null,
    updates: buildCompetitionEloUpdatesFromMatchRecord(record, players, options),
  };
}

/**
 * @param {Object} [options]
 * @returns {boolean}
 */
export function isDatabaseRatingBackendAvailable(options = {}) {
  if (typeof options.applyDatabaseRating === "function") {
    return true;
  }
  if (options.ratingDatabaseResult) {
    return true;
  }
  return shouldPreferDatabaseRating(options) && hasSupabaseConfig();
}
