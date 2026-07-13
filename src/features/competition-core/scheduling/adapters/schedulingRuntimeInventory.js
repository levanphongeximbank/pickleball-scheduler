export const SCHEDULING_RUNTIME_ADAPTER_VERSION = "cc09-v1";

/** @type {ReadonlyArray<{ id: string, functionName?: string, legacyEngine: string, consumer: string, mode: string }>} */
export const LEGACY_SCHEDULING_RUNTIME_INVENTORY = Object.freeze([
  {
    id: "legacy-group-stage-schedule",
    functionName: "buildGroupStageSchedule",
    legacyEngine: "tournament/engines/scheduleEngine",
    consumer: "group_stage",
    mode: "shadow",
  },
  {
    id: "legacy-round-robin-fixtures",
    functionName: "buildRoundRobinRounds",
    legacyEngine: "pages/tournament.fixtures.logic",
    consumer: "round_robin",
    mode: "shadow",
  },
  {
    id: "legacy-te-generate-schedule",
    functionName: "generateSchedule",
    legacyEngine: "features/tournament-engine/engines/scheduleEngine",
    consumer: "tournament_engine",
    mode: "shadow",
  },
  {
    id: "legacy-team-tournament-schedule",
    functionName: "buildStructuredRoundRobinMatchups",
    legacyEngine: "features/team-tournament/engines/teamRoundRobinScheduleEngine",
    consumer: "team_tournament",
    mode: "shadow",
  },
  {
    id: "legacy-session-scheduling",
    functionName: "runAI",
    legacyEngine: "ai/engine",
    consumer: "session_matchmaking",
    mode: "legacy_only",
  },
  {
    id: "legacy-director-court-runtime",
    functionName: "assignMatchToCourt",
    legacyEngine: "tournament/engines/courtEngine",
    consumer: "director_runtime",
    mode: "legacy_only",
  },
  {
    id: "canonical-scheduling-runtime",
    functionName: "evaluateCanonicalSchedulingRuntime",
    legacyEngine: "competition-core/scheduling",
    consumer: "scheduling_v2_adapter",
    mode: "shadow",
  },
]);

/**
 * @param {string} functionName
 */
export function findSchedulingRuntimeNode(functionName) {
  return LEGACY_SCHEDULING_RUNTIME_INVENTORY.find((item) => item.functionName === functionName);
}

export function buildSchedulingRuntimeCallGraph() {
  return {
    version: SCHEDULING_RUNTIME_ADAPTER_VERSION,
    nodes: LEGACY_SCHEDULING_RUNTIME_INVENTORY.map((item) => ({
      id: item.id,
      functionName: item.functionName,
      legacyEngine: item.legacyEngine,
      mode: item.mode,
    })),
    edges: [
      { from: "legacy-group-stage-schedule", to: "canonical-scheduling-runtime", mode: "shadow" },
      { from: "legacy-team-tournament-schedule", to: "canonical-scheduling-runtime", mode: "shadow" },
      { from: "legacy-te-generate-schedule", to: "canonical-scheduling-runtime", mode: "shadow" },
    ],
  };
}
