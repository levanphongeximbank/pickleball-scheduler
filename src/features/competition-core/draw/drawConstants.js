/** Canonical Draw Engine foundation constants — CC-04A. No runtime execution. */

export const DRAW_ENGINE_VERSION = "cc04a-v1";

export const DEFAULT_DRAW_RULE_SET_VERSION = "1";

/**
 * Canonical draw modes (CC-04A).
 * Distinct from CC-01 DRAW_MODE (pure_random / constrained_random / skill_controlled / manual).
 */
export const CANONICAL_DRAW_MODE = Object.freeze({
  SEEDED: "seeded",
  OPEN: "open",
  RANDOM: "random",
  SNAKE: "snake",
  HEURISTIC: "heuristic",
  TEAM: "team",
  MANUAL: "manual",
  CUSTOM: "custom",
  UNKNOWN: "unknown",
});

/** @type {ReadonlySet<string>} */
export const CANONICAL_DRAW_MODE_VALUES = new Set(Object.values(CANONICAL_DRAW_MODE));

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isCanonicalDrawMode(value) {
  return typeof value === "string" && CANONICAL_DRAW_MODE_VALUES.has(value);
}

/** Seed resolution sources — contract only. */
export const DRAW_SEED_SOURCE = Object.freeze({
  MANUAL: "manual",
  AVERAGE_LEVEL: "average_level",
  COMPETITION_ELO: "competition_elo",
  WIN_RATE: "win_rate",
  PERFORMANCE: "performance",
  PROVISIONAL: "provisional",
  NEW_PLAYER: "new_player",
  MANUAL_ADJUSTMENT: "manual_adjustment",
  UNKNOWN: "unknown",
});

/** @type {ReadonlySet<string>} */
export const DRAW_SEED_SOURCE_VALUES = new Set(Object.values(DRAW_SEED_SOURCE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDrawSeedSource(value) {
  return typeof value === "string" && DRAW_SEED_SOURCE_VALUES.has(value);
}

/** Strategy kinds — contracts only, no runtime implementation. */
export const DRAW_STRATEGY_KIND = Object.freeze({
  SEED: "seed_strategy",
  DISTRIBUTION: "distribution_strategy",
  CONSTRAINT: "constraint_strategy",
  BALANCING: "balancing_strategy",
  RANDOM: "random_strategy",
  AUDIT: "audit_strategy",
  EXPLAIN: "explain_strategy",
});

/** @type {ReadonlySet<string>} */
export const DRAW_STRATEGY_KIND_VALUES = new Set(Object.values(DRAW_STRATEGY_KIND));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDrawStrategyKind(value) {
  return typeof value === "string" && DRAW_STRATEGY_KIND_VALUES.has(value);
}

/** Draw constraint categories — contract only. */
export const DRAW_CONSTRAINT_CATEGORY = Object.freeze({
  GROUP_BALANCING: "group_balancing",
  CLUB_SEPARATION: "club_separation",
  ORGANIZATION_SEPARATION: "organization_separation",
  SEED_BALANCING: "seed_balancing",
  GENDER: "gender",
  SKILL: "skill",
  TEAM: "team",
  VENUE: "venue",
  CAPACITY: "capacity",
  CUSTOM: "custom",
});

/** @type {ReadonlySet<string>} */
export const DRAW_CONSTRAINT_CATEGORY_VALUES = new Set(
  Object.values(DRAW_CONSTRAINT_CATEGORY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDrawConstraintCategory(value) {
  return typeof value === "string" && DRAW_CONSTRAINT_CATEGORY_VALUES.has(value);
}

/** Deterministic random generator metadata kinds — no implementation. */
export const DRAW_RANDOM_GENERATOR = Object.freeze({
  MULBERRY32: "mulberry32",
  LEGACY_MATH_RANDOM: "legacy_math_random",
  INJECTED: "injected",
  UNKNOWN: "unknown",
});

/** @type {ReadonlySet<string>} */
export const DRAW_RANDOM_GENERATOR_VALUES = new Set(Object.values(DRAW_RANDOM_GENERATOR));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDrawRandomGenerator(value) {
  return typeof value === "string" && DRAW_RANDOM_GENERATOR_VALUES.has(value);
}
