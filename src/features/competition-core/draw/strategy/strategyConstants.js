/** Canonical Draw Strategy foundation constants — CC-04C. No runtime execution. */

export const DRAW_STRATEGY_ENGINE_VERSION = "cc04c-v1";

/**
 * Distribution algorithms — contract taxonomy only.
 * Does NOT invoke runtime snake/random/balance implementations.
 */
export const DISTRIBUTION_TYPE = Object.freeze({
  SNAKE: "snake",
  SEQUENTIAL: "sequential",
  RANDOM: "random",
  BALANCED: "balanced",
  HYBRID: "hybrid",
  MANUAL: "manual",
  ROUND_ROBIN: "round_robin",
  SWISS_READY: "swiss_ready",
  KNOCKOUT_PREP: "knockout_prep",
  CUSTOM: "custom",
  UNKNOWN: "unknown",
});

/** @type {ReadonlySet<string>} */
export const DISTRIBUTION_TYPE_VALUES = new Set(Object.values(DISTRIBUTION_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDistributionType(value) {
  return typeof value === "string" && DISTRIBUTION_TYPE_VALUES.has(value);
}

/** Canonical draw strategy catalog identifiers. */
export const CANONICAL_DRAW_STRATEGY_ID = Object.freeze({
  SNAKE: "strategy_snake",
  RANDOM: "strategy_random",
  BALANCED: "strategy_balanced",
  MANUAL: "strategy_manual",
  AI_HEURISTIC: "strategy_ai_heuristic",
  OPEN: "strategy_open",
  TEAM: "strategy_team",
  ROUND_ROBIN: "strategy_round_robin",
  SWISS: "strategy_swiss",
  KNOCKOUT_PREP: "strategy_knockout_prep",
  LEGACY_CUSTOM: "strategy_legacy_custom",
  UNKNOWN: "strategy_unknown",
});

/** @type {ReadonlySet<string>} */
export const CANONICAL_DRAW_STRATEGY_ID_VALUES = new Set(Object.values(CANONICAL_DRAW_STRATEGY_ID));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCanonicalDrawStrategyId(value) {
  return typeof value === "string" && CANONICAL_DRAW_STRATEGY_ID_VALUES.has(value);
}

/** Default capability flags for foundation catalog entries. */
export const DEFAULT_STRATEGY_CAPABILITIES = Object.freeze({
  requiresSeed: false,
  supportsConstraints: false,
  supportsBalance: false,
  supportsRandomization: false,
  supportsManualPlacement: false,
  supportsGroups: true,
  supportsByes: false,
  supportsTeams: false,
});
