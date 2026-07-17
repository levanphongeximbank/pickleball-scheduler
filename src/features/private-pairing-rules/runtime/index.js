export {
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_RUNTIME_VERSION,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";

export { createSeededRng, hashSeed, seededShuffle } from "./seededRng.js";

export {
  resolveActivePrivatePairingRules,
  dedupeEquivalentRules,
  isRuleActiveAt,
  doesRuleMatchScope,
  splitHardAndSoftRules,
} from "./resolveActiveRules.js";

export {
  PRIVATE_PAIRING_SOURCE,
  PRIVATE_PAIRING_SOURCE_VALUES,
  PRIVATE_PAIRING_SOURCE_PRIORITY,
  PRIVATE_PAIRING_SOURCE_ORDER,
  PRIVATE_PAIRING_OPERATION,
  PRIVATE_PAIRING_OPERATION_VALUES,
  isPrivatePairingSource,
  derivePrivatePairingSource,
  resolveRuleSourcePriority,
  derivePrivatePairingOperations,
  ruleMatchesOperation,
  compareRuleAuthority,
} from "./privatePairingSource.js";

export {
  evaluateHardPrivatePairingRules,
  shareTeam,
  shareGroup,
  areOpponents,
  normalizeTeamsToIdMatrix,
  normalizeGroupsToPlayerIds,
  playerIdOf,
} from "./evaluateHardOnCandidate.js";

export {
  scoreSoftPrivatePairingRules,
  computeBalanceScore,
  computeFairnessScore,
  computeHistoryScore,
} from "./scoreSoftOnCandidate.js";

export {
  generateTeamPairingCandidates,
  createMatchCandidate,
} from "./generateTeamCandidates.js";

export {
  runPrivatePairingRuntime,
  evaluatePrivatePairingCandidate,
  evaluatePrivatePairingMatchOption,
} from "./runPrivatePairingRuntime.js";

export {
  loadActiveRulesForLiveScope,
  prepareLivePrivatePairingOptions,
  buildPrivatePairingRuntimeError,
} from "./prepareLivePrivatePairingOptions.js";
export {
  resolveLivePairingScope,
  ensureRulesHaveScopeIds,
} from "./resolveLivePairingScope.js";

export {
  filterRulesForTeamFormation,
  isTeamFormationConstraintType,
  isExcludedFromTeamFormation,
  TEAM_FORMATION_TYPE_SET,
  EXCLUDED_FROM_TEAM_FORMATION,
} from "./teamFormationRuleFilter.js";

export {
  filterRulesForOpponentStage,
  filterRulesForGroupStage,
  isOpponentStageConstraintType,
  isGroupStageConstraintType,
  isExcludedFromOpponentStage,
  isExcludedFromGroupStage,
  OPPONENT_STAGE_TYPE_SET,
  GROUP_STAGE_TYPE_SET,
  EXCLUDED_FROM_OPPONENT_STAGE,
  EXCLUDED_FROM_GROUP_STAGE,
  GROUP_RELATION_TYPES,
} from "./stageRuleFilters.js";

export { gateResolvedForStage } from "./stageRuntimeGate.js";

export {
  buildRuleResolutionMetadata,
  emptyRuleResolutionMetadata,
} from "./ruleResolutionMetadata.js";

export {
  buildScoreBreakdown,
  normalizeScoreBreakdown,
  getCandidateScoreBreakdown,
  buildOptimizationRuleScore,
  compareOptimizationCandidates,
  normalizeOptimizationRuleScore,
  sortCandidatesByOptimizationRank,
} from "./optimizationCandidateComparator.js";

export {
  assignGroupsWithPrivatePairingRules,
  mapDifferentGroupRulesToLegacy,
  scoreGroupPlan,
} from "./applyPrivatePairingToGroupDivision.js";

export { assignOpenGroupsWithPrivatePairingRules } from "./applyPrivatePairingToOpenDraw.js";

export {
  buildMatchOptionFromSides,
  evaluateOpponentMatchupCandidate,
  filterAndRankMatchupsByOpponentRules,
  applyOpponentRulesToGroupStageSchedule,
} from "./applyPrivatePairingToMatchups.js";

export {
  founderCourtPoliciesToLegacyConstraints,
  gatePrivatePairingForRunAi,
  isNoFeasibleAiPairing,
  collectAiPairingRejectionCodes,
} from "./applyPrivatePairingToAiRuntime.js";
