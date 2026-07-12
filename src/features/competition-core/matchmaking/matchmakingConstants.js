/** Canonical Daily Matchmaking constants — CC-06. No runtime algorithm changes. */

export const MATCHMAKING_ENGINE_VERSION = "cc06-v1";

export const DEFAULT_MATCHMAKING_RULE_SET_VERSION = "1";

/** Canonical matchmaking strategy identifiers. */
export const MATCHMAKING_STRATEGY = Object.freeze({
  BALANCED: "balanced",
  FAIR: "fair",
  RANDOM: "random",
  WAITING_PRIORITY: "waiting_priority",
  DIRECTOR_LOCK: "director_lock",
  DAILY_PLAY: "daily_play",
  CUSTOM: "custom",
  UNKNOWN: "unknown",
});

/** @type {ReadonlySet<string>} */
export const MATCHMAKING_STRATEGY_VALUES = new Set(Object.values(MATCHMAKING_STRATEGY));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchmakingStrategy(value) {
  return typeof value === "string" && MATCHMAKING_STRATEGY_VALUES.has(value);
}

export const DEFAULT_MATCHMAKING_SCORE_WEIGHTS = Object.freeze({
  balanceScore: 0.35,
  historyScore: 0.25,
  waitingScore: 0.2,
  rulesScore: 0.15,
  pairingScore: 0.25,
  randomComponent: 0.02,
});
