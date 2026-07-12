import { MATCHMAKING_STRATEGY } from "./matchmakingConstants.js";

/** @type {ReadonlyArray<{ legacyKey: string, runtimePath: string, strategyId: string, callers: string[] }>} */
export const LEGACY_MATCHMAKING_STRATEGY_INVENTORY = Object.freeze([
  {
    legacyKey: "ai_balance",
    runtimePath: "src/ai/engine.js#runAI",
    strategyId: MATCHMAKING_STRATEGY.BALANCED,
    callers: ["SelectPlayers.jsx"],
  },
  {
    legacyKey: "daily_play_fair",
    runtimePath: "src/tournament/engines/dailyPlayEngine.js#createDailyMatchesWithAI",
    strategyId: MATCHMAKING_STRATEGY.DAILY_PLAY,
    callers: ["DailyPlaySetup.jsx", "tournamentDirectorEngine.js"],
  },
  {
    legacyKey: "waiting_priority",
    runtimePath: "src/ai/waiting.js#runWaitingEngine",
    strategyId: MATCHMAKING_STRATEGY.WAITING_PRIORITY,
    callers: ["runAI"],
  },
  {
    legacyKey: "pairing_engine",
    runtimePath: "src/ai/pairing.js#runPairingEngine",
    strategyId: MATCHMAKING_STRATEGY.BALANCED,
    callers: ["runAI"],
  },
  {
    legacyKey: "director_lock",
    runtimePath: "src/ai/engine.js#runAI",
    strategyId: MATCHMAKING_STRATEGY.DIRECTOR_LOCK,
    callers: ["SelectPlayers.jsx"],
  },
]);

const LEGACY_KEY_MAP = Object.freeze({
  balanced: MATCHMAKING_STRATEGY.BALANCED,
  ai_balance: MATCHMAKING_STRATEGY.BALANCED,
  fair: MATCHMAKING_STRATEGY.FAIR,
  daily_play: MATCHMAKING_STRATEGY.DAILY_PLAY,
  daily_play_fair: MATCHMAKING_STRATEGY.DAILY_PLAY,
  random: MATCHMAKING_STRATEGY.RANDOM,
  waiting: MATCHMAKING_STRATEGY.WAITING_PRIORITY,
  director_lock: MATCHMAKING_STRATEGY.DIRECTOR_LOCK,
  custom: MATCHMAKING_STRATEGY.CUSTOM,
});

/**
 * @param {unknown} legacyKey
 * @returns {string}
 */
export function mapLegacyMatchmakingStrategyToCanonical(legacyKey) {
  const key = String(legacyKey || "")
    .trim()
    .toLowerCase();
  return LEGACY_KEY_MAP[key] || MATCHMAKING_STRATEGY.UNKNOWN;
}

/**
 * @param {string} strategyId
 */
export function getMatchmakingStrategyFromCatalog(strategyId) {
  return LEGACY_MATCHMAKING_STRATEGY_INVENTORY.find((item) => item.strategyId === strategyId) || null;
}
