import {
  CANONICAL_SEED_SOURCE,
  DEFAULT_SEED_SCORE_WEIGHTS,
} from "./seedConstants.js";

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reference seed score model — CC-04B foundation.
 * Does NOT replace `seedEngine.js` runtime formula.
 *
 * @param {Object} input
 * @param {Record<string, number>} [weights]
 * @returns {import('./seedTypes.js').SeedScoreComponents}
 */
export function computeReferenceSeedScoreComponents(input = {}, weights = DEFAULT_SEED_SCORE_WEIGHTS) {
  const w = { ...DEFAULT_SEED_SCORE_WEIGHTS, ...weights };

  if (input.manualOverride === true && finiteOrNull(input.manualSeedNumber) != null) {
    const overrideScore = 9999 - Number(input.manualSeedNumber);
    return {
      baseScore: null,
      competitionEloComponent: null,
      averageLevelComponent: null,
      internalRatingComponent: null,
      winRateComponent: null,
      performanceComponent: null,
      manualAdjustment: null,
      provisionalPenalty: null,
      newPlayerPenalty: null,
      manualOverrideScore: overrideScore,
      total: overrideScore,
      weights: w,
    };
  }

  const competitionElo = finiteOrNull(input.competitionElo ?? input.elo);
  const averageLevel = finiteOrNull(input.averageLevel ?? input.level ?? input.rating);
  const internalRating = finiteOrNull(input.internalRating ?? input.ratingInternal);
  const winRate = finiteOrNull(input.winRate);
  const performance = finiteOrNull(input.performance ?? input.recentPerformance);
  const manualAdjustment = finiteOrNull(input.manualAdjustment ?? input.manualPriority) ?? 0;

  const competitionEloComponent =
    competitionElo != null ? (competitionElo / 2000) * w.competitionElo : 0;
  const averageLevelComponent =
    averageLevel != null ? (averageLevel / 8) * w.averageLevel : 0;
  const internalRatingComponent =
    internalRating != null ? (internalRating / 8) * w.internalRating : 0;
  const winRateComponent = winRate != null ? winRate * w.winRate : 0;
  const performanceComponent = performance != null ? performance * w.performance : 0;

  let provisionalPenalty = 0;
  if (input.provisional === true) {
    provisionalPenalty = w.provisionalPenalty;
  }

  let newPlayerPenalty = 0;
  if (input.newPlayer === true || input.unseeded === true) {
    newPlayerPenalty = w.newPlayerPenalty;
  }

  const baseScore =
    competitionEloComponent +
    averageLevelComponent +
    internalRatingComponent +
    winRateComponent +
    performanceComponent;

  const total =
    baseScore +
    manualAdjustment * w.manualAdjustment -
    provisionalPenalty -
    newPlayerPenalty;

  return {
    baseScore,
    competitionEloComponent,
    averageLevelComponent,
    internalRatingComponent,
    winRateComponent,
    performanceComponent,
    manualAdjustment,
    provisionalPenalty,
    newPlayerPenalty,
    manualOverrideScore: null,
    total,
    weights: w,
  };
}

/**
 * Resolve primary canonical source from participant metrics.
 *
 * @param {Record<string, unknown>} participant
 * @returns {string}
 */
export function resolveReferenceRatingSource(participant = {}) {
  if (participant.manualOverride === true || participant.manualSeedOverride != null) {
    return CANONICAL_SEED_SOURCE.MANUAL;
  }
  if (participant.tournamentOverride === true || participant.stripped === true) {
    return CANONICAL_SEED_SOURCE.TOURNAMENT_OVERRIDE;
  }
  if (participant.source != null && typeof participant.source === "string") {
    return String(participant.source);
  }
  if (participant.competitionElo != null || participant.elo != null) {
    return CANONICAL_SEED_SOURCE.COMPETITION_ELO;
  }
  if (participant.ratingInternal != null || participant.internalRating != null) {
    return CANONICAL_SEED_SOURCE.INTERNAL_RATING;
  }
  if (participant.legacyBlob === true || participant.fromBlob === true) {
    return CANONICAL_SEED_SOURCE.LEGACY_BLOB;
  }
  if (participant.ranking != null) {
    return CANONICAL_SEED_SOURCE.RANKING;
  }
  if (participant.level != null || participant.rating != null || participant.averageLevel != null) {
    return CANONICAL_SEED_SOURCE.AVERAGE_LEVEL;
  }
  return CANONICAL_SEED_SOURCE.UNKNOWN;
}

/**
 * Build human-readable seed reason from score components.
 *
 * @param {string} source
 * @param {import('./seedTypes.js').SeedScoreComponents} score
 * @param {import('./seedTypes.js').SeedAdjustment[]} adjustments
 * @returns {string}
 */
export function buildReferenceSeedReason(source, score, adjustments = []) {
  if (source === CANONICAL_SEED_SOURCE.MANUAL) {
    return "Manual seed override";
  }

  const parts = [];
  if (source === CANONICAL_SEED_SOURCE.COMPETITION_ELO) {
    parts.push("Competition Elo");
  }
  if (source === CANONICAL_SEED_SOURCE.AVERAGE_LEVEL) {
    parts.push("Average level");
  }
  if (source === CANONICAL_SEED_SOURCE.INTERNAL_RATING) {
    parts.push("Internal rating");
  }
  if (score.performanceComponent > 0) {
    parts.push("Performance");
  }
  if (score.winRateComponent > 0) {
    parts.push("Win rate");
  }
  if (adjustments.some((item) => item.kind === CANONICAL_SEED_SOURCE.MANUAL_ADJUSTMENT)) {
    parts.push("Manual adjustment");
  }
  if (score.provisionalPenalty > 0) {
    parts.push("Provisional penalty");
  }
  if (score.newPlayerPenalty > 0) {
    parts.push("New player handling");
  }

  return parts.length ? parts.join(" + ") : "Reference seed score";
}

/**
 * Estimate confidence contract (0–1) from available metrics.
 *
 * @param {Record<string, unknown>} participant
 * @returns {number}
 */
export function estimateReferenceSeedConfidence(participant = {}) {
  let signals = 0;
  let present = 0;

  const fields = [
    "competitionElo",
    "elo",
    "averageLevel",
    "level",
    "rating",
    "internalRating",
    "ratingInternal",
    "winRate",
    "performance",
    "recentPerformance",
  ];

  fields.forEach((field) => {
    signals += 1;
    if (participant[field] != null && Number.isFinite(Number(participant[field]))) {
      present += 1;
    }
  });

  if (participant.provisional === true) {
    return Math.max(0, present / Math.max(1, signals) - 0.2);
  }
  if (participant.newPlayer === true) {
    return Math.max(0, present / Math.max(1, signals) - 0.3);
  }

  return signals ? present / signals : 0;
}
