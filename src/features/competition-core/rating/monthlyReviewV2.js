import { getPlayerCurrentRating } from "../../../models/player.js";
import {
  getMonthKey,
  isMonthlyReviewDue,
  snapPublicLevel,
} from "../../../tournament/engines/skillLevelEngine.js";
import { RATING_SOURCE } from "../constants/ratingSource.js";
import { DEFAULT_MONTHLY_REVIEW_V2_RULES } from "./ratingConstants.js";
import { mapCompetitionEloToSkill } from "./mapCompetitionEloToSkill.js";
import {
  buildRatingSnapshotFromPlayer,
  getPlayerCompetitionElo,
  getPlayerRatingConfidencePercent,
} from "./playerRatingCompat.js";

function toRating(value, fallback = 3.5) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {Object} [rules]
 * @returns {Object}
 */
export function normalizeMonthlyReviewV2Rules(rules = {}) {
  return {
    ...DEFAULT_MONTHLY_REVIEW_V2_RULES,
    ...rules,
    minValidMatches: Math.max(
      1,
      Number(rules.minValidMatches ?? DEFAULT_MONTHLY_REVIEW_V2_RULES.minValidMatches)
    ),
    minPlayingDays: Math.max(
      1,
      Number(rules.minPlayingDays ?? DEFAULT_MONTHLY_REVIEW_V2_RULES.minPlayingDays)
    ),
    minUniqueOpponents: Math.max(
      1,
      Number(rules.minUniqueOpponents ?? DEFAULT_MONTHLY_REVIEW_V2_RULES.minUniqueOpponents)
    ),
    minConfidence: Math.max(
      0,
      Number(rules.minConfidence ?? DEFAULT_MONTHLY_REVIEW_V2_RULES.minConfidence)
    ),
  };
}

/**
 * @param {Object} player
 * @param {Object} [rules]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function evaluateMonthlyReviewV2Gates(player, rules = {}) {
  const normalized = normalizeMonthlyReviewV2Rules(rules);
  const reasons = [];
  const matchCount = Number(player?.competitionMatchCount ?? player?.rating_match_count ?? 0);

  if (matchCount < normalized.minValidMatches) {
    reasons.push("insufficient_valid_matches");
  }

  const confidence = getPlayerRatingConfidencePercent(player);
  if (confidence < normalized.minConfidence) {
    reasons.push("insufficient_confidence");
  }

  const uniqueOpponents = Number(player?.skillMeta?.uniqueOpponentsCount ?? 0);
  if (uniqueOpponents > 0 && uniqueOpponents < normalized.minUniqueOpponents) {
    reasons.push("insufficient_unique_opponents");
  }

  const playingDays = Number(player?.skillMeta?.playingDaysCount ?? 0);
  if (playingDays > 0 && playingDays < normalized.minPlayingDays) {
    reasons.push("insufficient_playing_days");
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Compare mapped competition Elo to public skill — never compare raw scales.
 *
 * @param {number} publicLevel
 * @param {number} competitionElo
 * @param {number} confidence
 * @param {Object} [rules]
 */
export function computePublicLevelFromCompetitionElo(publicLevel, competitionElo, confidence, rules = {}) {
  const normalized = normalizeMonthlyReviewV2Rules(rules);
  const pub = toRating(publicLevel);
  const mapped = mapCompetitionEloToSkill(competitionElo, { confidence });
  const estimated = mapped.estimatedSkillLevel;

  if (estimated >= pub + normalized.promoteThreshold) {
    const nextLevel = snapPublicLevel(pub + normalized.step, normalized);
    if (nextLevel > pub) {
      return { nextLevel, changed: true, direction: "up", estimatedSkillLevel: estimated, mapping: mapped };
    }
  }

  if (estimated <= pub - normalized.demoteThreshold) {
    const nextLevel = snapPublicLevel(pub - normalized.step, normalized);
    if (nextLevel < pub) {
      return { nextLevel, changed: true, direction: "down", estimatedSkillLevel: estimated, mapping: mapped };
    }
  }

  return {
    nextLevel: pub,
    changed: false,
    direction: "none",
    estimatedSkillLevel: estimated,
    mapping: mapped,
  };
}

/**
 * Monthly review V2 — creates proposal data only; does not auto-update public skill.
 *
 * @param {Object} player
 * @param {Object} [rules]
 * @param {Date|string} [now]
 * @param {Object} [options]
 */
export function assessMonthlyPublicLevelV2(player, rules = {}, now = new Date(), options = {}) {
  if (!player?.id) {
    return null;
  }

  const normalizedRules = normalizeMonthlyReviewV2Rules(rules);
  const skillMeta = player.skillMeta || {};

  if (!options.force && !isMonthlyReviewDue(skillMeta, now)) {
    return null;
  }

  const gates = evaluateMonthlyReviewV2Gates(player, normalizedRules);
  if (!gates.ok && !options.skipGates) {
    return {
      playerId: String(player.id),
      playerName: String(player.name || "").trim(),
      changed: false,
      direction: "none",
      skipped: true,
      skipReasons: gates.reasons,
      reviewMonth: getMonthKey(now),
    };
  }

  const snapshot = buildRatingSnapshotFromPlayer(player);
  const publicLevel = toRating(getPlayerCurrentRating(player));
  const competitionElo = getPlayerCompetitionElo(player);
  const confidence = getPlayerRatingConfidencePercent(player);
  const decision = computePublicLevelFromCompetitionElo(
    publicLevel,
    competitionElo,
    confidence,
    normalizedRules
  );

  return {
    playerId: String(player.id),
    playerName: String(player.name || "").trim(),
    previousLevel: publicLevel,
    nextLevel: decision.changed ? decision.nextLevel : publicLevel,
    competitionElo,
    estimatedSkillLevel: decision.estimatedSkillLevel,
    mappingVersion: decision.mapping?.mappingVersion ?? "v1",
    confidence,
    changed: decision.changed,
    direction: decision.direction,
    reviewMonth: getMonthKey(now),
    ratingSnapshot: snapshot,
    source: RATING_SOURCE.MONTHLY_REVIEW,
  };
}

/**
 * @param {Object} assessment
 * @param {Date|string} [now]
 */
export function createMonthlyReviewV2Proposal(assessment, now = new Date()) {
  if (!assessment?.changed) {
    return null;
  }

  const reviewedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  return {
    id: `slpv2-${assessment.playerId}-${assessment.reviewMonth}`,
    playerId: assessment.playerId,
    playerName: assessment.playerName || "",
    reviewMonth: assessment.reviewMonth,
    currentLevel: assessment.previousLevel,
    proposedLevel: assessment.nextLevel,
    competitionElo: assessment.competitionElo,
    estimatedSkillLevel: assessment.estimatedSkillLevel,
    mappingVersion: assessment.mappingVersion,
    confidence: assessment.confidence,
    direction: assessment.direction,
    status: "pending",
    ratingStatus: "under_review",
    source: "competition_core_monthly_review_v2",
    createdAt: reviewedAt,
    reviewedAt: null,
    expiresAt: null,
  };
}
