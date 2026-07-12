/** Canonical Team Formation Engine foundation constants — CC-05A. No runtime execution. */

export const FORMATION_ENGINE_VERSION = "cc05a-v1";

export const DEFAULT_FORMATION_RULE_SET_VERSION = "1";

/** Canonical formation strategy catalog identifiers. */
export const FORMATION_STRATEGY = Object.freeze({
  BALANCED: "balanced",
  RANDOM: "random",
  SNAKE: "snake",
  ROTATION: "rotation",
  KING_OF_COURT: "king_of_court",
  MIXED: "mixed",
  FIXED_PARTNER: "fixed_partner",
  ROTATING_PARTNER: "rotating_partner",
  TEAM_MATCH: "team_match",
  CUSTOM: "custom",
  UNKNOWN: "unknown",
});

/** @type {ReadonlySet<string>} */
export const FORMATION_STRATEGY_VALUES = new Set(Object.values(FORMATION_STRATEGY));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFormationStrategy(value) {
  return typeof value === "string" && FORMATION_STRATEGY_VALUES.has(value);
}

/** Canonical formation constraint kinds — contract taxonomy only. */
export const FORMATION_CONSTRAINT_KIND = Object.freeze({
  MUST_PARTNER: "must_partner",
  MUST_NOT_PARTNER: "must_not_partner",
  AVOID_REPEAT_PARTNER: "avoid_repeat_partner",
  AVOID_REPEAT_OPPONENT: "avoid_repeat_opponent",
  SKILL_GAP: "skill_gap",
  GENDER: "gender",
  AGE: "age",
  AVAILABILITY: "availability",
  CHECK_IN: "check_in",
  REST_TIME: "rest_time",
  COURT_AVAILABILITY: "court_availability",
  MANUAL_LOCK: "manual_lock",
  ORGANIZATION: "organization",
  CLUB: "club",
  CUSTOM: "custom",
});

/** @type {ReadonlySet<string>} */
export const FORMATION_CONSTRAINT_KIND_VALUES = new Set(Object.values(FORMATION_CONSTRAINT_KIND));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFormationConstraintKind(value) {
  return typeof value === "string" && FORMATION_CONSTRAINT_KIND_VALUES.has(value);
}

/** Reference score weights — foundation only, not wired to runtime. */
export const DEFAULT_FORMATION_SCORE_WEIGHTS = Object.freeze({
  skillScore: 0.35,
  repeatPenalty: 0.2,
  opponentPenalty: 0.15,
  restPenalty: 0.1,
  genderBonus: 0.05,
  balanceScore: 0.25,
  availabilityScore: 0.1,
  manualAdjustment: 1,
  randomComponent: 0.02,
});
