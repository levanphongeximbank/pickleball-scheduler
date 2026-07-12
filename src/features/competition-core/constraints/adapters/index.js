export {
  createDecisionTrace,
  createDecisionTraceRecord,
  appendDecisionTrace,
  summarizeDecisionTrace,
} from "./decisionTrace.js";

export {
  RULES_DECISION_STATUS,
  RULES_RUNTIME_TRACE_VERSION,
  createRulesRuntimeTraceRecord,
  buildCompleteRulesRuntimeTraceRecord,
  isRulesRuntimeTraceJsonSerializable,
  redactRulesRuntimeTraceSecrets,
  validateRulesRuntimeTraceRecord,
} from "./rulesDecisionTrace.js";

export {
  RULES_RUNTIME_ERROR_CODE,
  createRulesRuntimeError,
  isRulesRuntimeErrorCode,
  isHardRulesRuntimeFailure,
} from "./rulesErrorModel.js";

export {
  RULES_RUNTIME_ADAPTER_VERSION,
  LEGACY_RULES_RUNTIME_INVENTORY,
  buildRulesRuntimeCallGraph,
  findRulesRuntimeInventoryByFunction,
} from "./rulesRuntimeInventory.js";

export {
  evaluateCanonicalRulesRuntime,
} from "./rulesRuntimeOrchestrator.js";

export {
  buildRulesShadowComparison,
  createMemoizedRulesExecutor,
  runRulesShadowComparison,
} from "./rulesShadowParity.js";

export {
  evaluateLegacyGroupConstraints,
  validateGroupConstraintsPreDraw,
  validateGroupConstraintsPostDraw,
} from "./groupConstraintsBridge.js";

export {
  evaluateLegacyTeamLineupValidation,
  evaluateLegacyCaptainSubmissionValidation,
  evaluateLegacyRefereeMatchEligibility,
  evaluateLegacyTournamentEntryValidation,
} from "./teamTournamentRulesBridge.js";

export {
  mapPairingConstraintsToRuleSet,
  mapAiContextToRuleSet,
  mapAiOptionToCandidate,
  mapTeamsToCandidateTeams,
  mapPlayersToSnapshots,
  mapAiHistoryToRepeatCounts,
  mapCourtEngineConfigToRuleSet,
  mapCourtMatchHistoryToRepeatCounts,
  mapCourtSessionPlayersToSnapshots,
  mapDailyPlaySettingsToRuleSet,
  mapTournamentDrawInputToRuleSet,
  mapTournamentDrawInputToContext,
  mapTournamentEntriesToCandidate,
  mapGroupConstraintsToRuleSet,
  mapGroupConstraintsToContext,
  mapTeamLineupValidationToContext,
  mapTeamLineupValidationToRuleSet,
  mapRefereeMatchEligibilityToContext,
} from "./legacyRuleMappers.js";

export {
  toPairingConstraintEvaluation,
  toAiScoreBridgeResult,
  toValidationResult,
  mergeValidationResults,
  toCourtQueueGateResult,
  toCourtEngineScoreBridgeResult,
  isDailyPlayPlayerEligible,
} from "./adaptLegacyResult.js";

export {
  evaluateLegacyRulesBridge,
  evaluateLegacyPairingConstraints,
  evaluateLegacyAiPairScore,
  evaluateLegacyTournamentValidation,
  evaluateLegacyTournamentDrawValidation,
  evaluateLegacyDailyPlayPlayer,
  evaluateLegacyCourtEngineRules,
  evaluateLegacyCourtEngineQueueGate,
  evaluateLegacyCourtEngineCombinationScore,
} from "./constraintsEvaluationBridge.js";
