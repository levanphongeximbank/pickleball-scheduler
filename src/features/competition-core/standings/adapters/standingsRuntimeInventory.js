export const STANDINGS_RUNTIME_ADAPTER_VERSION = "cc08-v1";

/** @type {Array<{ id: string, functionName: string, legacyEngine: string, consumer: string }>} */
export const LEGACY_STANDINGS_RUNTIME_INVENTORY = Object.freeze([
  {
    id: "legacy-group-ranking",
    functionName: "buildGroupStandingFromMatches",
    legacyEngine: "rankingEngine",
    consumer: "individual_group",
  },
  {
    id: "legacy-te-ranking",
    functionName: "computeRankings",
    legacyEngine: "tournament-engine/rankingEngine",
    consumer: "tournament_engine",
  },
  {
    id: "legacy-team-standings",
    functionName: "computeTeamStandings",
    legacyEngine: "teamStandingsEngine",
    consumer: "team_tournament",
  },
  {
    id: "legacy-session-standings",
    functionName: "buildGroupStandingFromSessions",
    legacyEngine: "tournament.standings.logic",
    consumer: "session_group",
  },
  {
    id: "legacy-season-standings",
    functionName: "buildLeagueStandingsRows",
    legacyEngine: "seasonStandingsEngine",
    consumer: "season_league",
  },
  {
    id: "canonical-standings-runtime",
    functionName: "evaluateCanonicalStandingsRuntime",
    legacyEngine: "competition-core/standings",
    consumer: "standings_v2_adapter",
  },
]);

/**
 * @param {string} functionName
 */
export function findStandingsRuntimeInventoryByFunction(functionName) {
  return LEGACY_STANDINGS_RUNTIME_INVENTORY.find((item) => item.functionName === functionName);
}

export function buildStandingsRuntimeCallGraph() {
  return {
    version: STANDINGS_RUNTIME_ADAPTER_VERSION,
    nodes: LEGACY_STANDINGS_RUNTIME_INVENTORY.map((item) => ({
      id: item.id,
      label: item.functionName,
      legacyEngine: item.legacyEngine,
      consumer: item.consumer,
    })),
    edges: [
      { from: "legacy-group-ranking", to: "canonical-standings-runtime", mode: "shadow" },
      { from: "legacy-team-standings", to: "canonical-standings-runtime", mode: "shadow" },
    ],
  };
}
