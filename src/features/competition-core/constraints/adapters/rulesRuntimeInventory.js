export const RULES_RUNTIME_ADAPTER_VERSION = "cc07-v1";

/**
 * @typedef {Object} RulesRuntimeInventoryEntry
 * @property {string} legacyKey
 * @property {string} runtimeFunction
 * @property {string} runtimePath
 * @property {string} ruleType
 * @property {string[]} callers
 * @property {'hard'|'soft'|'mixed'} behavior
 * @property {'legacy'|'canonical'|'dual'} bridgeStatus
 * @property {'low'|'medium'|'high'} duplicationRisk
 */

/** @type {ReadonlyArray<RulesRuntimeInventoryEntry>} */
export const LEGACY_RULES_RUNTIME_INVENTORY = Object.freeze([
  {
    legacyKey: "pairing_constraints",
    runtimeFunction: "evaluatePartnerConstraintsForTeams",
    runtimePath: "pairing-constraints/engines/constraintEvaluator.js",
    ruleType: "partner/opponent",
    callers: ["runAI", "constraintPairingEngine"],
    behavior: "mixed",
    bridgeStatus: "canonical",
    duplicationRisk: "medium",
  },
  {
    legacyKey: "group_constraints",
    runtimeFunction: "evaluateGroupConstraints",
    runtimePath: "pairing-constraints/engines/constraintEvaluator.js",
    ruleType: "same_club_separation",
    callers: ["assignGroupsWithConstraints", "officialTournamentEngine", "internalTournamentEngine"],
    behavior: "mixed",
    bridgeStatus: "canonical",
    duplicationRisk: "high",
  },
  {
    legacyKey: "ai_scoring",
    runtimeFunction: "calculatePairScore",
    runtimePath: "ai/scoring.js",
    ruleType: "skill/repeat/mixed/founder",
    callers: ["runAI", "runPairingEngine"],
    behavior: "mixed",
    bridgeStatus: "canonical",
    duplicationRisk: "high",
  },
  {
    legacyKey: "daily_play_eligibility",
    runtimeFunction: "filterEligiblePlayers",
    runtimePath: "tournament/engines/dailyPlayEngine.js",
    ruleType: "entry_eligibility",
    callers: ["DailyPlaySetup", "tournamentDirectorEngine"],
    behavior: "hard",
    bridgeStatus: "canonical",
    duplicationRisk: "low",
  },
  {
    legacyKey: "court_queue_gate",
    runtimeFunction: "enqueuePlayer",
    runtimePath: "court-engine/services/queueService.js",
    ruleType: "checkin/busy",
    callers: ["CourtEngine UI"],
    behavior: "hard",
    bridgeStatus: "canonical",
    duplicationRisk: "low",
  },
  {
    legacyKey: "court_combination_score",
    runtimeFunction: "scoreCombination",
    runtimePath: "court-engine/engines/autoCourtAssignmentEngine.js",
    ruleType: "repeat/rest",
    callers: ["autoCourtAssignmentEngine"],
    behavior: "soft",
    bridgeStatus: "canonical",
    duplicationRisk: "medium",
  },
  {
    legacyKey: "tournament_draw_validation",
    runtimeFunction: "validateDrawInput",
    runtimePath: "tournament/engines/validationEngine.js",
    ruleType: "entry/duplicate",
    callers: ["officialTournamentEngine", "internalTournamentEngine"],
    behavior: "hard",
    bridgeStatus: "canonical",
    duplicationRisk: "medium",
  },
  {
    legacyKey: "tournament_validation",
    runtimeFunction: "evaluateLegacyTournamentValidation",
    runtimePath: "competition-core/constraints/adapters/constraintsEvaluationBridge.js",
    ruleType: "candidate_validation",
    callers: ["competition-core"],
    behavior: "mixed",
    bridgeStatus: "canonical",
    duplicationRisk: "low",
  },
  {
    legacyKey: "team_lineup_validation",
    runtimeFunction: "validateLineupSelections",
    runtimePath: "team-tournament/engines/lineupValidationEngine.js",
    ruleType: "lineup_validity/gender/roster",
    callers: ["TeamPortal", "lineupEngine", "TeamLineupOverrideDialog"],
    behavior: "hard",
    bridgeStatus: "canonical",
    duplicationRisk: "medium",
  },
  {
    legacyKey: "captain_submission",
    runtimeFunction: "submitLineup",
    runtimePath: "team-tournament/engines/lineupEngine.js",
    ruleType: "deadline/lock/permission",
    callers: ["TeamPortal"],
    behavior: "hard",
    bridgeStatus: "canonical",
    duplicationRisk: "medium",
  },
  {
    legacyKey: "referee_match_eligibility",
    runtimeFunction: "validateRefereeMatchAction",
    runtimePath: "team-tournament/engines/lineupStateMachine.js",
    ruleType: "lineup_state/referee_scope",
    callers: ["TeamRefereePortal", "teamTournamentService"],
    behavior: "hard",
    bridgeStatus: "canonical",
    duplicationRisk: "low",
  },
  {
    legacyKey: "founder_policy",
    runtimeFunction: "constraintsToCourtPolicies",
    runtimePath: "pairing-constraints/adapters/courtPolicyAdapter.js",
    ruleType: "avoid/prefer",
    callers: ["SelectPlayers", "runAI"],
    behavior: "mixed",
    bridgeStatus: "dual",
    duplicationRisk: "high",
  },
  {
    legacyKey: "manual_locks",
    runtimeFunction: "runAI",
    runtimePath: "ai/engine.js",
    ruleType: "director_lock",
    callers: ["SelectPlayers"],
    behavior: "hard",
    bridgeStatus: "legacy",
    duplicationRisk: "low",
  },
  {
    legacyKey: "duplicate_player_check",
    runtimeFunction: "validateDrawInput",
    runtimePath: "tournament/engines/validationEngine.js",
    ruleType: "entry_eligibility",
    callers: ["tournament validation"],
    behavior: "hard",
    bridgeStatus: "canonical",
    duplicationRisk: "medium",
  },
]);

/**
 * @returns {{ nodes: string[], edges: Array<{ from: string, to: string, label?: string }> }}
 */
export function buildRulesRuntimeCallGraph() {
  const nodes = new Set(["evaluateCanonicalRulesRuntime"]);
  const edges = [];

  LEGACY_RULES_RUNTIME_INVENTORY.forEach((entry) => {
    nodes.add(entry.runtimeFunction);
    nodes.add(entry.runtimePath);
    edges.push({
      from: entry.callers[0] || "consumer",
      to: entry.runtimeFunction,
      label: entry.legacyKey,
    });
    if (entry.bridgeStatus === "canonical" || entry.bridgeStatus === "dual") {
      edges.push({
        from: entry.runtimeFunction,
        to: "evaluateCanonicalRulesRuntime",
        label: entry.legacyKey,
      });
    }
  });

  return {
    nodes: [...nodes],
    edges,
  };
}

/**
 * @param {string} runtimeFunction
 * @returns {RulesRuntimeInventoryEntry|null}
 */
export function findRulesRuntimeInventoryByFunction(runtimeFunction) {
  return (
    LEGACY_RULES_RUNTIME_INVENTORY.find((item) => item.runtimeFunction === runtimeFunction) ||
    null
  );
}
