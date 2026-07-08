import { syncCurrentRatingMirrors } from "../../models/player.js";
import { snapPickVnRating } from "../../features/pick-vn-rating/constants/pickVnRatingScale.js";

const DEFAULT_K_FACTOR = 32;
const DEFAULT_RATING = 3.5;

function toRating(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_RATING;
}

function resolveInternalRating(player) {
  if (player?.skillLevel !== undefined && player?.skillLevel !== null && player?.skillLevel !== "") {
    return toRating(player.skillLevel);
  }

  if (
    player?.ratingInternal !== undefined &&
    player?.ratingInternal !== null &&
    player?.ratingInternal !== ""
  ) {
    return toRating(player.ratingInternal);
  }

  return toRating(player?.rating ?? player?.level, DEFAULT_RATING);
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function calculateEloDelta(ratingA, ratingB, scoreA, scoreB, kFactor = DEFAULT_K_FACTOR) {
  const safeA = toRating(ratingA);
  const safeB = toRating(ratingB);
  const actualA =
    Number(scoreA) === Number(scoreB) ? 0.5 : Number(scoreA) > Number(scoreB) ? 1 : 0;
  const expectedA = expectedScore(safeA, safeB);
  const deltaA = kFactor * (actualA - expectedA);

  return {
    deltaA,
    deltaB: -deltaA,
  };
}

function averageTeamRating(playerIds = [], ratingsByPlayerId = new Map()) {
  const ratings = playerIds
    .map((playerId) => ratingsByPlayerId.get(String(playerId)))
    .filter((value) => Number.isFinite(value));

  if (!ratings.length) {
    return DEFAULT_RATING;
  }

  return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
}

export function buildEloUpdatesFromMatchRecord(record, players = [], options = {}) {
  const kFactor = Number(options.kFactor ?? DEFAULT_K_FACTOR);
  const teamA = (record?.teamAPlayerIds || []).map(String);
  const teamB = (record?.teamBPlayerIds || []).map(String);

  if (!teamA.length || !teamB.length) {
    return [];
  }

  const ratingsByPlayerId = new Map(
    (players || []).map((player) => [String(player.id), resolveInternalRating(player)])
  );

  const teamARating = averageTeamRating(teamA, ratingsByPlayerId);
  const teamBRating = averageTeamRating(teamB, ratingsByPlayerId);
  const { deltaA, deltaB } = calculateEloDelta(
    teamARating,
    teamBRating,
    record.scoreA,
    record.scoreB,
    kFactor
  );

  const updates = [];

  teamA.forEach((playerId) => {
    const current = ratingsByPlayerId.get(playerId) ?? DEFAULT_RATING;
    updates.push({
      playerId,
      previousRating: current,
      nextRating: Math.round((current + deltaA) * 100) / 100,
      delta: Math.round(deltaA * 100) / 100,
    });
  });

  teamB.forEach((playerId) => {
    const current = ratingsByPlayerId.get(playerId) ?? DEFAULT_RATING;
    updates.push({
      playerId,
      previousRating: current,
      nextRating: Math.round((current + deltaB) * 100) / 100,
      delta: Math.round(deltaB * 100) / 100,
    });
  });

  return updates;
}

export function applyEloUpdatesToPlayers(players = [], updates = [], options = {}) {
  const updateMap = new Map(updates.map((item) => [String(item.playerId), item]));
  const updatedAt =
    options.updatedAt ||
    (options.now instanceof Date ? options.now.toISOString() : new Date().toISOString());

  return (players || []).map((player) => {
    const update = updateMap.get(String(player.id));
    if (!update) {
      return player;
    }

    const nextRating = update.nextRating;
    const publicRating = snapPickVnRating(nextRating);
    return {
      ...player,
      ...syncCurrentRatingMirrors(publicRating),
      ratingInternal: nextRating,
      skillMeta: {
        ...(player.skillMeta || {}),
        lastRatingInternalUpdateAt: updatedAt,
      },
    };
  });
}
