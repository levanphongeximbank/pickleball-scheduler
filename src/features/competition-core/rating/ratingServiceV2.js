import { normalizePlayers } from "../../../models/player.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { applyCompetitionEloAtomically } from "./ratingAtomicApply.js";
import { backfillPlayerRatingV2Fields } from "./playerRatingCompat.js";
import {
  applyMatchRatingViaConfiguredBackend,
  buildDatabaseRatingRpcParams,
  isDatabaseRatingBackendAvailable,
  shouldPreferDatabaseRating,
} from "./ratingRpcService.js";
import {
  applyCompetitionEloUpdatesToPlayers,
} from "./competitionEloEngine.js";

/**
 * Mirror database-applied ratings into club blob for offline UI only — not SSOT.
 *
 * @param {string} clubId
 * @param {Object} record
 * @param {Array} updates
 * @param {Object} [options]
 */
export function mirrorDatabaseRatingToClubBlob(clubId, record, updates, options = {}) {
  if (options.mirrorDatabaseToBlob === false || !updates?.length) {
    return;
  }

  const data = loadClubData(clubId);
  data.players = normalizePlayers(
    applyCompetitionEloUpdatesToPlayers(data.players || [], updates, options)
  );
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);
}

/**
 * Apply competition Elo V2 — database RPC preferred when configured; blob fallback.
 *
 * @param {string} clubId
 * @param {Object} record
 * @param {Object} [options]
 * @returns {import('./ratingRpcService.js').RatingDatabaseApplyResult|ReturnType<typeof applyCompetitionEloAtomically>|Promise<any>}
 */
export function applyCompetitionEloFromMatchRecord(clubId, record, options = {}) {
  const preferDatabase = shouldPreferDatabaseRating(options);

  if (preferDatabase && isDatabaseRatingBackendAvailable(options)) {
    const data = loadClubData(clubId);
    const params = buildDatabaseRatingRpcParams(record, data.players || [], {
      ...options,
      clubId,
    });

    if (!params.updates.length) {
      return applyCompetitionEloAtomically(clubId, record, options);
    }

    const backendResult = applyMatchRatingViaConfiguredBackend(
      options.supabaseClient ?? options.supabase ?? null,
      params,
      options
    );

    if (backendResult && typeof backendResult.then === "function") {
      return backendResult.then((resolved) =>
        finalizeDatabaseRatingApply(clubId, record, params.updates, resolved, options)
      );
    }

    const finalized = finalizeDatabaseRatingApply(
      clubId,
      record,
      params.updates,
      backendResult,
      options
    );

    if (finalized?.fallbackToBlob) {
      return applyCompetitionEloAtomically(clubId, record, options);
    }

    return finalized;
  }

  return applyCompetitionEloAtomically(clubId, record, options);
}

/**
 * @param {string} clubId
 * @param {Object} record
 * @param {Array} updates
 * @param {import('./ratingRpcService.js').RatingDatabaseApplyResult} backendResult
 * @param {Object} options
 */
export function finalizeDatabaseRatingApply(clubId, record, updates, backendResult, options = {}) {
  if (backendResult?.ok && !backendResult.skipped) {
    mirrorDatabaseRatingToClubBlob(clubId, record, updates, options);
    return {
      ...backendResult,
      engine: "competition-core-rating-v2",
      idempotency: "rating_applications",
      blobMirror: options.mirrorDatabaseToBlob !== false,
    };
  }

  if (backendResult?.ok && backendResult.skipped) {
    return {
      ...backendResult,
      engine: "competition-core-rating-v2",
      idempotency: "rating_applications",
    };
  }

  if (options.fallbackBlobOnRpcFailure === false) {
    return {
      ok: false,
      error: backendResult?.error || "database-apply-failed",
      backend: "database",
    };
  }

  return {
    fallbackToBlob: true,
    databaseError: backendResult?.error || "database-apply-failed",
  };
}

/**
 * Backfill V2 rating fields for all players in a club blob (non-destructive).
 *
 * @param {string} clubId
 * @param {Object} [options]
 * @returns {{ ok: boolean, updated: number }}
 */
export function backfillClubPlayerRatingsV2(clubId, options = {}) {
  const data = loadClubData(clubId);
  let updated = 0;

  data.players = normalizePlayers(
    (data.players || []).map((player) => {
      const needsBackfill =
        player.competitionElo === undefined ||
        player.competitionElo === null ||
        player.competitionElo === "";

      if (!needsBackfill && !options.force) {
        return player;
      }

      updated += 1;
      return backfillPlayerRatingV2Fields(player, {
        source: options.source ?? "cc02-backfill",
        backfilledAt: options.backfilledAt,
      });
    })
  );

  if (updated > 0) {
    data.updatedAt = new Date().toISOString();
    saveClubData(clubId, data);
  }

  return { ok: true, updated };
}
