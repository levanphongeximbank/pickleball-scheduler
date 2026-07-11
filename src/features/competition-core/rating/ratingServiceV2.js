import { applyCompetitionEloAtomically } from "./ratingAtomicApply.js";
import { backfillPlayerRatingV2Fields } from "./playerRatingCompat.js";
import { normalizePlayers } from "../../../models/player.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";

/**
 * Apply competition Elo V2 from a match record — public skill unchanged.
 * Uses atomic apply with durable per-player idempotency markers.
 *
 * @param {string} clubId
 * @param {Object} record
 * @param {Object} [options]
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string|null, updates?: Array, eligibility?: Object }}
 */
export function applyCompetitionEloFromMatchRecord(clubId, record, options = {}) {
  return applyCompetitionEloAtomically(clubId, record, options);
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
