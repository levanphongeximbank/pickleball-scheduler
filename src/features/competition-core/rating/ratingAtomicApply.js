import { normalizePlayers } from "../../../models/player.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { isMatchRatingEligible } from "./isMatchRatingEligible.js";
import {
  applyCompetitionEloUpdatesToPlayers,
  buildCompetitionEloUpdatesFromMatchRecord,
} from "./competitionEloEngine.js";
import {
  appendRatingApplicationsToClubData,
  buildRatingApplicationEntries,
  getRatingApplicationsFromClubData,
  hasLegacyMatchLevelApplication,
  hasRatingApplication,
} from "./ratingIdempotencyStore.js";
import { RATING_TYPE } from "./ratingConstants.js";

/**
 * @typedef {Object} RatingHistoryEntry
 * @property {string} matchId
 * @property {string} playerId
 * @property {string} fieldName
 * @property {number} previousValue
 * @property {number} nextValue
 * @property {number} delta
 * @property {string} source
 * @property {string} createdAt
 */

/**
 * @param {Array<{ playerId: string, previousRating: number, nextRating: number, delta?: number }>} updates
 * @param {string} matchId
 * @param {Object} [options]
 * @returns {RatingHistoryEntry[]}
 */
export function buildRatingHistoryEntries(updates, matchId, options = {}) {
  const createdAt =
    options.createdAt ||
    (options.now instanceof Date ? options.now.toISOString() : new Date().toISOString());
  const source = options.historySource || "competition-core-rating-v2";

  return (updates || []).map((update) => ({
    matchId: String(matchId),
    playerId: String(update.playerId),
    fieldName: "competition_elo",
    previousValue: Number(update.previousRating),
    nextValue: Number(update.nextRating),
    delta: Number(update.delta ?? update.nextRating - update.previousRating),
    source,
    createdAt,
  }));
}

/**
 * @param {Object|null|undefined} data
 * @param {RatingHistoryEntry[]} entries
 */
export function appendRatingHistoryToClubData(data, entries) {
  const existing = Array.isArray(data?.ratingV2History) ? data.ratingV2History : [];
  data.ratingV2History = [...existing, ...entries];
}

/**
 * Atomic competition Elo apply — single save; rolls back on simulated/test failures.
 *
 * @param {string} clubId
 * @param {Object} record
 * @param {Object} [options]
 * @param {number} [options.simulateFailAfterPlayerIndex] Fail after applying N player updates (0-based)
 * @param {boolean} [options.simulateHistoryFailure] Fail before persisting history
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string|null, updates?: Array, eligibility?: Object, rolledBack?: boolean, error?: string }}
 */
export function applyCompetitionEloAtomically(clubId, record, options = {}) {
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
  const matchId = String(record.id);
  const ratingType = options.ratingType || RATING_TYPE.COMPETITION_ELO;
  const applications = getRatingApplicationsFromClubData(data);

  const updates = buildCompetitionEloUpdatesFromMatchRecord(
    record,
    data.players || [],
    options
  );

  if (!updates.length) {
    return { ok: true, skipped: true, updates: [], reason: "no-updates", eligibility };
  }

  const playerIds = updates.map((update) => String(update.playerId));
  const alreadyApplied = playerIds.filter((playerId) =>
    hasRatingApplication(applications, matchId, playerId, ratingType)
  );

  if (alreadyApplied.length > 0 || hasLegacyMatchLevelApplication(data, matchId)) {
    return {
      ok: true,
      skipped: true,
      reason: "already-applied",
      updates: [],
      eligibility,
      idempotent: true,
    };
  }

  const snapshotPlayers = JSON.parse(JSON.stringify(data.players || []));
  let nextPlayers = snapshotPlayers;

  for (let index = 0; index < updates.length; index += 1) {
    if (options.simulateFailAfterPlayerIndex === index) {
      return {
        ok: false,
        error: "simulated-player-update-failure",
        rolledBack: true,
        updates: [],
        eligibility,
      };
    }

    nextPlayers = applyCompetitionEloUpdatesToPlayers(
      nextPlayers,
      [updates[index]],
      options
    );
  }

  const historyEntries = buildRatingHistoryEntries(updates, matchId, options);

  if (options.simulateHistoryFailure) {
    return {
      ok: false,
      error: "simulated-history-failure",
      rolledBack: true,
      updates: [],
      eligibility,
    };
  }

  const applicationEntries = buildRatingApplicationEntries(updates, matchId, options);

  try {
    data.players = normalizePlayers(nextPlayers);
    appendRatingApplicationsToClubData(data, applicationEntries);
    appendRatingHistoryToClubData(data, historyEntries);
    data.updatedAt = new Date().toISOString();
    saveClubData(clubId, data);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      rolledBack: true,
      updates: [],
      eligibility,
    };
  }

  return {
    ok: true,
    skipped: false,
    updates,
    eligibility,
    engine: "competition-core-rating-v2",
    idempotency: "ratingV2Applications",
  };
}
