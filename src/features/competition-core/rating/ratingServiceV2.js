import { normalizePlayers } from "../../../models/player.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { isMatchRatingEligible } from "./isMatchRatingEligible.js";
import {
  applyCompetitionEloUpdatesToPlayers,
  buildCompetitionEloUpdatesFromMatchRecord,
} from "./competitionEloEngine.js";
import { backfillPlayerRatingV2Fields } from "./playerRatingCompat.js";

/**
 * Apply competition Elo V2 from a match record — public skill unchanged.
 *
 * @param {string} clubId
 * @param {Object} record
 * @param {Object} [options]
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string|null, updates?: Array, eligibility?: Object }}
 */
export function applyCompetitionEloFromMatchRecord(clubId, record, options = {}) {
  if (!record?.id) {
    return { ok: true, skipped: true, updates: [], reason: "missing-record" };
  }

  const eligibility = isMatchRatingEligible(record, options);
  if (!eligibility.eligible) {
    return {
      ok: true,
      skipped: true,
      reason: eligibility.reason,
      eligibility,
      updates: [],
    };
  }

  const data = loadClubData(clubId);
  const updates = buildCompetitionEloUpdatesFromMatchRecord(
    record,
    data.players || [],
    options
  );

  if (!updates.length) {
    return { ok: true, skipped: true, updates: [], reason: "no-updates", eligibility };
  }

  data.players = normalizePlayers(
    applyCompetitionEloUpdatesToPlayers(data.players || [], updates, options)
  );
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, skipped: false, updates, eligibility, engine: "competition-core-rating-v2" };
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
