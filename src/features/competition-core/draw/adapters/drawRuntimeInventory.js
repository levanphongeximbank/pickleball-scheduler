/** CC-04D runtime inventory — reference call graph, no execution. */

export const DRAW_RUNTIME_ADAPTER_VERSION = "cc04d-v1";

/**
 * @typedef {Object} DrawRuntimeInventoryEntry
 * @property {string} legacyKey
 * @property {string} runtimeFunction
 * @property {string} runtimePath
 * @property {string} strategyId
 * @property {string[]} callers
 * @property {boolean} production
 */

/** @type {ReadonlyArray<DrawRuntimeInventoryEntry>} */
export const LEGACY_DRAW_RUNTIME_INVENTORY = Object.freeze([
  {
    legacyKey: "skill_controlled",
    runtimeFunction: "assignGroupsWithConstraints",
    runtimePath: "src/features/pairing-constraints/engines/constraintGroupEngine.js",
    strategyId: "strategy_snake",
    callers: ["buildInternalTournamentPlan", "buildOfficialAiBalancePlan"],
    production: true,
  },
  {
    legacyKey: "skill_controlled",
    runtimeFunction: "assignEntriesToGroupsSnake",
    runtimePath: "src/tournament/engines/seededGroupEngine.js",
    strategyId: "strategy_snake",
    callers: ["assignGroupsWithConstraints", "generateDraw"],
    production: true,
  },
  {
    legacyKey: "open",
    runtimeFunction: "assignEntriesOpenConditional",
    runtimePath: "src/tournament/engines/openConditionalRandomEngine.js",
    strategyId: "strategy_random",
    callers: ["buildOfficialOpenPlan"],
    production: true,
  },
  {
    legacyKey: "heuristic",
    runtimeFunction: "generateDraw",
    runtimePath: "src/features/tournament-engine/engines/drawEngine.js",
    strategyId: "strategy_ai_heuristic",
    callers: ["runDrawEngine", "groupSuggestion.js"],
    production: false,
  },
  {
    legacyKey: "official_open",
    runtimeFunction: "buildOfficialOpenPlan",
    runtimePath: "src/tournament/engines/officialTournamentEngine.js",
    strategyId: "strategy_open",
    callers: ["OfficialTournamentSetup.jsx", "tournamentFlowAdapters.js"],
    production: true,
  },
  {
    legacyKey: "official_ai_balance",
    runtimeFunction: "buildOfficialAiBalancePlan",
    runtimePath: "src/tournament/engines/officialTournamentEngine.js",
    strategyId: "strategy_balanced",
    callers: ["OfficialTournamentSetup.jsx"],
    production: true,
  },
  {
    legacyKey: "mlp_auto_draw",
    runtimeFunction: "assignSeededTeamsToGroups",
    runtimePath: "src/features/team-tournament/engines/teamAutoDrawEngine.js",
    strategyId: "strategy_team",
    callers: ["TeamGroupDivisionPanel.jsx"],
    production: true,
  },
  {
    legacyKey: "manual",
    runtimeFunction: "manualEntries",
    runtimePath: "src/tournament/engines/internalTournamentEngine.js",
    strategyId: "strategy_manual",
    callers: ["InternalTournamentSetup.jsx", "OfficialTournamentSetup.jsx"],
    production: true,
  },
  {
    legacyKey: "group_stage_schedule",
    runtimeFunction: "buildGroupStageSchedule",
    runtimePath: "src/tournament/engines/scheduleEngine.js",
    strategyId: "strategy_round_robin",
    callers: ["internalTournamentEngine", "officialTournamentEngine", "groupInterventionEngine"],
    production: true,
  },
  {
    legacyKey: "knockout_bracket",
    runtimeFunction: "generateKnockoutBracket",
    runtimePath: "src/tournament/engines/bracketEngine.js",
    strategyId: "strategy_knockout_prep",
    callers: ["bracket flows"],
    production: true,
  },
  {
    legacyKey: "custom",
    runtimeFunction: "seedTeamsIntoGroups",
    runtimePath: "src/pages/tournament.seeding.logic.js",
    strategyId: "strategy_legacy_custom",
    callers: ["Tournament.jsx", "animationUtils.js"],
    production: true,
  },
]);

/**
 * @returns {{ version: string, nodes: string[], edges: Array<{ from: string, to: string }> }}
 */
export function buildDrawRuntimeCallGraph() {
  const nodes = new Set();
  const edges = [];

  for (const entry of LEGACY_DRAW_RUNTIME_INVENTORY) {
    nodes.add(entry.runtimeFunction);
    for (const caller of entry.callers) {
      nodes.add(caller);
      edges.push({ from: caller, to: entry.runtimeFunction });
    }
  }

  return {
    version: DRAW_RUNTIME_ADAPTER_VERSION,
    nodes: [...nodes].sort(),
    edges,
  };
}

/**
 * @param {string} runtimeFunction
 * @returns {DrawRuntimeInventoryEntry[]}
 */
export function findDrawRuntimeInventoryByFunction(runtimeFunction) {
  return LEGACY_DRAW_RUNTIME_INVENTORY.filter(
    (item) => item.runtimeFunction === runtimeFunction
  );
}
