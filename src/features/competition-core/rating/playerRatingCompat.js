import { getPlayerCurrentRating, getPlayerRatingInternal } from "../../../models/player.js";
import { COMPETITION_RATING_STATUS } from "../constants/ratingStatus.js";
import { DEFAULT_COMPETITION_ELO } from "./ratingConstants.js";
import {
  detectRatingStorageScale,
  mapSkillToCompetitionElo,
} from "./mapCompetitionEloToSkill.js";
import { createRatingSnapshot } from "../contracts/engineContracts.js";

/**
 * Read competition Elo with V2-first, legacy fallback.
 *
 * @param {Object|null|undefined} player
 * @param {number} [fallbackElo]
 * @returns {number}
 */
export function getPlayerCompetitionElo(player, fallbackElo = DEFAULT_COMPETITION_ELO) {
  if (!player) {
    return fallbackElo;
  }

  if (
    player.competitionElo !== undefined &&
    player.competitionElo !== null &&
    player.competitionElo !== ""
  ) {
    const parsed = Number(player.competitionElo);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const internal = getPlayerRatingInternal(player, null);
  if (internal !== null && Number.isFinite(Number(internal))) {
    const numeric = Number(internal);
    if (detectRatingStorageScale(numeric) === "competition_elo") {
      return numeric;
    }
    return mapSkillToCompetitionElo(numeric);
  }

  const publicSkill = getPlayerCurrentRating(player, null);
  if (publicSkill !== null && Number.isFinite(Number(publicSkill))) {
    return mapSkillToCompetitionElo(Number(publicSkill));
  }

  return fallbackElo;
}

/**
 * @param {Object|null|undefined} player
 * @returns {number}
 */
export function getPlayerCompetitionMatchCount(player) {
  const count =
    player?.competitionMatchCount ??
    player?.rating_match_count ??
    player?.ratingMatchCount ??
    0;
  return Math.max(0, Number(count) || 0);
}

/**
 * @param {Object|null|undefined} player
 * @returns {number} 0–100
 */
export function getPlayerRatingConfidencePercent(player) {
  const raw = player?.rating_confidence ?? player?.ratingConfidence ?? 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
}

/**
 * Build a RatingSnapshot from player blob (read-only).
 *
 * @param {Object|null|undefined} player
 * @returns {import('../types/index.js').RatingSnapshot}
 */
export function buildRatingSnapshotFromPlayer(player) {
  if (!player) {
    return createRatingSnapshot();
  }

  const publicSkillLevel = getPlayerCurrentRating(player, null);
  const competitionElo = getPlayerCompetitionElo(player);
  const confidence = getPlayerRatingConfidencePercent(player);

  return createRatingSnapshot({
    publicSkillLevel,
    competitionElo,
    dailyPlayRating: player.dailyPlayRating ?? null,
    ratingConfidence: confidence,
    ratingStatus: player.rating_status ?? COMPETITION_RATING_STATUS.PROVISIONAL,
    provisionalSkillLevel: player.provisional_rating ?? player.provisionalSkillLevel ?? null,
    source: player.ratingSource ?? null,
  });
}

/**
 * Backfill V2 fields onto a player without overwriting existing competitionElo.
 *
 * @param {Object} player
 * @param {Object} [options]
 * @param {string} [options.source]
 * @returns {Object}
 */
export function backfillPlayerRatingV2Fields(player, options = {}) {
  if (!player?.id) {
    return player;
  }

  const hasCompetitionElo =
    player.competitionElo !== undefined &&
    player.competitionElo !== null &&
    player.competitionElo !== "";

  const publicSkill = getPlayerCurrentRating(player, 3.5);
  const inferredElo = hasCompetitionElo
    ? Number(player.competitionElo)
    : mapSkillToCompetitionElo(getPlayerRatingInternal(player, publicSkill));

  return {
    ...player,
    competitionElo: hasCompetitionElo ? player.competitionElo : inferredElo,
    competitionMatchCount: getPlayerCompetitionMatchCount(player),
    dailyPlayRating: player.dailyPlayRating ?? null,
    ratingV2BackfillSource: options.source ?? "migration",
    ratingV2BackfilledAt: options.backfilledAt ?? new Date().toISOString(),
  };
}
