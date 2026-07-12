/** CC-05B runtime inventory — reference call graph, no execution. */

export const FORMATION_RUNTIME_ADAPTER_VERSION = "cc05b-v1";

/**
 * @typedef {Object} FormationRuntimeInventoryEntry
 * @property {string} legacyKey
 * @property {string} runtimeFunction
 * @property {string} runtimePath
 * @property {string} strategyId
 * @property {string[]} callers
 * @property {boolean} production
 */

/** @type {ReadonlyArray<FormationRuntimeInventoryEntry>} */
export const LEGACY_FORMATION_RUNTIME_INVENTORY = Object.freeze([
  {
    legacyKey: "mlp_team_pairing",
    runtimeFunction: "pairTeamsFromSelectedPlayers",
    runtimePath: "src/features/team-tournament/engines/teamAutoDrawEngine.js",
    strategyId: "team_match",
    callers: ["TeamAiPairingDialog.jsx"],
    production: true,
  },
  {
    legacyKey: "ai_balance",
    runtimeFunction: "runAI",
    runtimePath: "src/ai/engine.js",
    strategyId: "balanced",
    callers: ["SelectPlayers.jsx", "dailyPlayEngine.js"],
    production: true,
  },
  {
    legacyKey: "daily_play_fair",
    runtimeFunction: "runAI",
    runtimePath: "src/tournament/engines/dailyPlayEngine.js",
    strategyId: "balanced",
    callers: ["DailyPlayPanel", "dailyPlayEngine.js"],
    production: true,
  },
  {
    legacyKey: "mixed_doubles",
    runtimeFunction: "createMixedPairsFromPlayers",
    runtimePath: "src/tournament/engines/teamPairingEngine.js",
    strategyId: "mixed",
    callers: ["suggestTeamsFromPlayers", "tournamentPlayerPicker.js"],
    production: true,
  },
  {
    legacyKey: "snake_pairing",
    runtimeFunction: "createTeamsFromPlayers",
    runtimePath: "src/pages/tournament.seeding.logic.js",
    strategyId: "snake",
    callers: ["suggestTeamsFromPlayers", "teamPairingEngine.js"],
    production: true,
  },
  {
    legacyKey: "fixed_partner",
    runtimeFunction: "optimizeTeamsWithConstraints",
    runtimePath: "src/features/pairing-constraints/engines/constraintPairingEngine.js",
    strategyId: "fixed_partner",
    callers: ["teamPairingEngine.js", "FounderPairingConstraintsPanel"],
    production: true,
  },
  {
    legacyKey: "pure_random",
    runtimeFunction: "pairingEngine",
    runtimePath: "src/ai/pairing.js",
    strategyId: "random",
    callers: ["runAI", "engine.js"],
    production: true,
  },
  {
    legacyKey: "rotation",
    runtimeFunction: "queueService",
    runtimePath: "src/features/court-engine/services/queueService.js",
    strategyId: "rotation",
    callers: ["court-engine flows"],
    production: true,
  },
  {
    legacyKey: "king_of_court",
    runtimeFunction: "kingOfCourt",
    runtimePath: "src/features/court-engine",
    strategyId: "king_of_court",
    callers: ["court-engine flows"],
    production: false,
  },
  {
    legacyKey: "custom",
    runtimeFunction: "manualPairingOverride",
    runtimePath: "src/features/pairing-intervention",
    strategyId: "custom",
    callers: ["entryInterventionEngine.js", "usePairingIntervention.js"],
    production: true,
  },
  {
    legacyKey: "ai_assistant",
    runtimeFunction: "buildPairingSuggestion",
    runtimePath: "src/features/ai-assistant/engines/pairingSuggestion.js",
    strategyId: "balanced",
    callers: ["aiEngineService.js"],
    production: false,
  },
  {
    legacyKey: "open_double",
    runtimeFunction: "suggestTeamsFromPlayers",
    runtimePath: "src/tournament/engines/teamPairingEngine.js",
    strategyId: "balanced",
    callers: ["OfficialTournamentSetup", "InternalTournamentSetup"],
    production: true,
  },
]);

/**
 * @returns {{ version: string, nodes: string[], edges: Array<{ from: string, to: string }> }}
 */
export function buildFormationRuntimeCallGraph() {
  const nodes = new Set();
  const edges = [];

  for (const entry of LEGACY_FORMATION_RUNTIME_INVENTORY) {
    nodes.add(entry.runtimeFunction);
    for (const caller of entry.callers) {
      nodes.add(caller);
      edges.push({ from: caller, to: entry.runtimeFunction });
    }
  }

  return {
    version: FORMATION_RUNTIME_ADAPTER_VERSION,
    nodes: [...nodes].sort(),
    edges,
  };
}

/**
 * @param {string} runtimeFunction
 * @returns {FormationRuntimeInventoryEntry[]}
 */
export function findFormationRuntimeInventoryByFunction(runtimeFunction) {
  return LEGACY_FORMATION_RUNTIME_INVENTORY.filter(
    (item) => item.runtimeFunction === runtimeFunction
  );
}
