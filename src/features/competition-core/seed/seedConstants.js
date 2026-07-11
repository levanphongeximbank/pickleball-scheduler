/** Canonical Seed Engine foundation constants — CC-04B. No runtime execution. */

export const SEED_ENGINE_VERSION = "cc04b-v1";

export const DEFAULT_SEED_RULE_SET_VERSION = "1";

/**
 * Canonical seed rating sources (CC-04B).
 * Extends CC-04A DRAW_SEED_SOURCE with audit-discovered legacy paths.
 */
export const CANONICAL_SEED_SOURCE = Object.freeze({
  MANUAL: "manual",
  AVERAGE_LEVEL: "average_level",
  INTERNAL_RATING: "internal_rating",
  COMPETITION_ELO: "competition_elo",
  CLUB_ELO: "club_elo",
  WIN_RATE: "win_rate",
  PERFORMANCE: "performance",
  RANKING: "ranking",
  PROVISIONAL: "provisional",
  NEW_PLAYER: "new_player",
  MANUAL_ADJUSTMENT: "manual_adjustment",
  LEGACY_BLOB: "legacy_blob",
  TOURNAMENT_OVERRIDE: "tournament_override",
  COMPOSITE: "composite",
  RANDOM: "random",
  UNKNOWN: "unknown",
});

/** @type {ReadonlySet<string>} */
export const CANONICAL_SEED_SOURCE_VALUES = new Set(Object.values(CANONICAL_SEED_SOURCE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCanonicalSeedSource(value) {
  return typeof value === "string" && CANONICAL_SEED_SOURCE_VALUES.has(value);
}

/** Pipeline stage identifiers — design contract only. */
export const SEED_PIPELINE_STAGE = Object.freeze({
  INPUT: "input",
  NORMALIZE: "normalize",
  RESOLVE_RATING_SOURCE: "resolve_rating_source",
  RESOLVE_ADJUSTMENTS: "resolve_adjustments",
  COMPUTE_SCORE: "compute_canonical_seed_score",
  ASSIGN_RANK: "seed_rank",
  TIE_BREAK: "tie_break",
  BUILD_SEED_OBJECT: "seed_object",
});

/** Tie-break rule kinds — contract only. */
export const SEED_TIEBREAK_KIND = Object.freeze({
  MANUAL_SEED: "manual_seed",
  HIGHER_ELO: "higher_elo",
  HIGHER_WIN_RATE: "higher_win_rate",
  HIGHER_PERFORMANCE: "higher_performance",
  REGISTRATION_TIME: "registration_time",
  RANDOM_SEED: "random_seed",
});

/** @type {ReadonlySet<string>} */
export const SEED_TIEBREAK_KIND_VALUES = new Set(Object.values(SEED_TIEBREAK_KIND));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSeedTieBreakKind(value) {
  return typeof value === "string" && SEED_TIEBREAK_KIND_VALUES.has(value);
}

/** Default weight contract for reference scoring (not wired to runtime). */
export const DEFAULT_SEED_SCORE_WEIGHTS = Object.freeze({
  baseScore: 1,
  competitionElo: 0.4,
  averageLevel: 0.25,
  internalRating: 0.25,
  winRate: 0.15,
  performance: 0.15,
  manualAdjustment: 0.05,
  provisionalPenalty: 0.1,
  newPlayerPenalty: 0.15,
});

/** Default tie-break order contract. */
export const DEFAULT_SEED_TIEBREAK_ORDER = Object.freeze([
  SEED_TIEBREAK_KIND.MANUAL_SEED,
  SEED_TIEBREAK_KIND.HIGHER_ELO,
  SEED_TIEBREAK_KIND.HIGHER_WIN_RATE,
  SEED_TIEBREAK_KIND.HIGHER_PERFORMANCE,
  SEED_TIEBREAK_KIND.REGISTRATION_TIME,
  SEED_TIEBREAK_KIND.RANDOM_SEED,
]);

/** CC-04A DRAW_SEED_SOURCE → CC-04B CANONICAL_SEED_SOURCE */
export const DRAW_SEED_SOURCE_TO_CANONICAL = Object.freeze({
  manual: CANONICAL_SEED_SOURCE.MANUAL,
  average_level: CANONICAL_SEED_SOURCE.AVERAGE_LEVEL,
  competition_elo: CANONICAL_SEED_SOURCE.COMPETITION_ELO,
  win_rate: CANONICAL_SEED_SOURCE.WIN_RATE,
  performance: CANONICAL_SEED_SOURCE.PERFORMANCE,
  provisional: CANONICAL_SEED_SOURCE.PROVISIONAL,
  new_player: CANONICAL_SEED_SOURCE.NEW_PLAYER,
  manual_adjustment: CANONICAL_SEED_SOURCE.MANUAL_ADJUSTMENT,
  unknown: CANONICAL_SEED_SOURCE.UNKNOWN,
});
