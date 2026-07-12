/** CC-06 runtime inventory — reference call graph, no execution. */

export const MATCHMAKING_RUNTIME_ADAPTER_VERSION = "cc06-v1";

/**
 * @typedef {Object} MatchmakingRuntimeInventoryEntry
 * @property {string} legacyKey
 * @property {string} runtimeFunction
 * @property {string} runtimePath
 * @property {string} strategyId
 * @property {string[]} callers
 * @property {boolean} production
 */

/** @type {ReadonlyArray<MatchmakingRuntimeInventoryEntry>} */
export const LEGACY_MATCHMAKING_RUNTIME_INVENTORY = Object.freeze([
  {
    legacyKey: "ai_balance",
    runtimeFunction: "runAI",
    runtimePath: "src/ai/engine.js",
    strategyId: "balanced",
    callers: ["SelectPlayers.jsx"],
    production: true,
  },
  {
    legacyKey: "daily_play_fair",
    runtimeFunction: "createDailyMatchesWithAI",
    runtimePath: "src/tournament/engines/dailyPlayEngine.js",
    strategyId: "daily_play",
    callers: ["DailyPlaySetup.jsx", "tournamentDirectorEngine.js"],
    production: true,
  },
  {
    legacyKey: "waiting_priority",
    runtimeFunction: "runWaitingEngine",
    runtimePath: "src/ai/waiting.js",
    strategyId: "waiting_priority",
    callers: ["runAI"],
    production: true,
  },
  {
    legacyKey: "balance_engine",
    runtimeFunction: "runBalanceEngine",
    runtimePath: "src/ai/balance.js",
    strategyId: "balanced",
    callers: ["runAI"],
    production: true,
  },
  {
    legacyKey: "pairing_engine",
    runtimeFunction: "runPairingEngine",
    runtimePath: "src/ai/pairing.js",
    strategyId: "balanced",
    callers: ["runAI"],
    production: true,
  },
  {
    legacyKey: "director_lock",
    runtimeFunction: "runAI",
    runtimePath: "src/ai/engine.js",
    strategyId: "director_lock",
    callers: ["SelectPlayers.jsx"],
    production: true,
  },
  {
    legacyKey: "history_engine",
    runtimeFunction: "runHistoryEngine",
    runtimePath: "src/ai/history.js",
    strategyId: "balanced",
    callers: ["runAI"],
    production: true,
  },
  {
    legacyKey: "tournament_director",
    runtimeFunction: "runDailyPlayMatchGeneration",
    runtimePath: "src/tournament/engines/tournamentDirectorEngine.js",
    strategyId: "daily_play",
    callers: ["Director flows"],
    production: true,
  },
]);

export function buildMatchmakingRuntimeCallGraph() {
  const nodes = new Set();
  const edges = [];

  for (const entry of LEGACY_MATCHMAKING_RUNTIME_INVENTORY) {
    nodes.add(entry.runtimeFunction);
    for (const caller of entry.callers) {
      nodes.add(caller);
      edges.push({ from: caller, to: entry.runtimeFunction });
    }
  }

  return {
    version: MATCHMAKING_RUNTIME_ADAPTER_VERSION,
    nodes: [...nodes].sort(),
    edges,
  };
}

export function findMatchmakingRuntimeInventoryByFunction(runtimeFunction) {
  return LEGACY_MATCHMAKING_RUNTIME_INVENTORY.filter(
    (item) => item.runtimeFunction === runtimeFunction
  );
}
