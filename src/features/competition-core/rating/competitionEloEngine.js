import {
  calculateEloDelta,
  expectedScore,
} from "../../../tournament/engines/eloEngine.js";
import { resolveKFactor } from "./kFactorConfig.js";
import { getPlayerCompetitionElo, getPlayerCompetitionMatchCount } from "./playerRatingCompat.js";

export { expectedScore, calculateEloDelta };

function averageTeamElo(playerIds = [], eloByPlayerId = new Map(), fallback = 1500) {
  const values = playerIds
    .map((playerId) => eloByPlayerId.get(String(playerId)))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return fallback;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Build competition Elo updates using true Elo scale (1500+).
 *
 * @param {Object} record
 * @param {Object[]} [players]
 * @param {Object} [options]
 * @returns {Array<{playerId: string, previousRating: number, nextRating: number, delta: number, kFactor: number}>}
 */
export function buildCompetitionEloUpdatesFromMatchRecord(record, players = [], options = {}) {
  const teamA = (record?.teamAPlayerIds || []).map(String);
  const teamB = (record?.teamBPlayerIds || []).map(String);

  if (!teamA.length || !teamB.length) {
    return [];
  }

  const eloByPlayerId = new Map(
    (players || []).map((player) => [String(player.id), getPlayerCompetitionElo(player)])
  );
  const kByPlayerId = new Map(
    (players || []).map((player) => [
      String(player.id),
      Number(options.kFactor) || resolveKFactor(getPlayerCompetitionMatchCount(player)),
    ])
  );

  const teamARating = averageTeamElo(teamA, eloByPlayerId);
  const teamBRating = averageTeamElo(teamB, eloByPlayerId);

  const updates = [];

  teamA.forEach((playerId) => {
    const current = eloByPlayerId.get(playerId) ?? 1500;
    const kFactor = kByPlayerId.get(playerId) ?? 32;
    const { deltaA } = calculateEloDelta(
      current,
      teamBRating,
      record.scoreA,
      record.scoreB,
      kFactor
    );

    updates.push({
      playerId,
      previousRating: current,
      nextRating: Math.round(current + deltaA),
      delta: Math.round(deltaA),
      kFactor,
    });
  });

  teamB.forEach((playerId) => {
    const current = eloByPlayerId.get(playerId) ?? 1500;
    const kFactor = kByPlayerId.get(playerId) ?? 32;
    const { deltaA } = calculateEloDelta(
      current,
      teamARating,
      record.scoreB,
      record.scoreA,
      kFactor
    );

    updates.push({
      playerId,
      previousRating: current,
      nextRating: Math.round(current + deltaA),
      delta: Math.round(deltaA),
      kFactor,
    });
  });

  return updates;
}

/**
 * Apply competition Elo updates — does NOT mutate public skill fields.
 *
 * @param {Object[]} players
 * @param {Array<{playerId: string, nextRating: number, delta?: number, kFactor?: number}>} updates
 * @param {Object} [options]
 * @returns {Object[]}
 */
export function applyCompetitionEloUpdatesToPlayers(players = [], updates = [], options = {}) {
  const updateMap = new Map(updates.map((item) => [String(item.playerId), item]));
  const updatedAt =
    options.updatedAt ||
    (options.now instanceof Date ? options.now.toISOString() : new Date().toISOString());

  return (players || []).map((player) => {
    const update = updateMap.get(String(player.id));
    if (!update) {
      return player;
    }

    const previousCount = getPlayerCompetitionMatchCount(player);

    return {
      ...player,
      competitionElo: update.nextRating,
      competitionMatchCount: previousCount + 1,
      ratingInternal: player.ratingInternal,
      skillMeta: {
        ...(player.skillMeta || {}),
        lastCompetitionEloUpdateAt: updatedAt,
        lastCompetitionEloDelta: update.delta ?? null,
        lastCompetitionKFactor: update.kFactor ?? null,
      },
    };
  });
}
