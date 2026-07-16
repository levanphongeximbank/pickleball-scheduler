export {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_CONSTRAINT_TYPE_VALUES,
  PERSONAL_PREFERENCE_CONSTRAINT_TYPES,
  TYPES_REQUIRING_PRIMARY_AND_TARGETS,
  isPrivatePairingConstraintType,
} from "./constants/constraintTypes.js";

export {
  PRIVATE_PAIRING_SCOPE,
  PRIVATE_PAIRING_SCOPE_VALUES,
  SCOPES_REQUIRING_ID,
  isPrivatePairingScope,
} from "./constants/scopes.js";

export {
  RELATION_MODE,
  RULE_VISIBILITY,
  RULE_PRIORITY,
  REASON_CATEGORY,
  COMPETITION_CLASS,
  RESTRICTED_COMPETITION_CLASSES,
  isRelationMode,
  isRuleVisibility,
  isRulePriority,
  isReasonCategory,
} from "./constants/enums.js";

export {
  PRIVATE_PAIRING_VALIDATION_CODE,
  PRIVATE_PAIRING_CONFLICT_CODE,
  FEATURE_FLAG_KEYS,
  isPrivatePairingRulesEnabled,
  isUnifiedConstraintEngineEnabled,
  isPrivatePairingSimulationEnabled,
} from "./constants/codes.js";

export {
  normalizePrivatePairingRule,
  normalizePrivatePairingRules,
  createPrivatePairingRule,
} from "./contracts/normalizePrivatePairingRule.js";

export {
  LEGACY_TO_PRIVATE_PAIRING_TYPE,
  mapLegacyTypeAndMode,
  mapLegacyFounderConstraint,
} from "./mappers/legacyFounderMapping.js";

export {
  validatePrivatePairingRule,
  validatePrivatePairingRules,
} from "./validation/validatePrivatePairingRule.js";

export {
  detectPrivatePairingConflicts,
  createPrivatePairingConflict,
} from "./conflicts/detectPrivatePairingConflicts.js";

export { timeRangesOverlap, scopesOverlap, rulesOverlapInContext } from "./conflicts/scopeTimeOverlap.js";

export {
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_RUNTIME_VERSION,
  isPrivatePairingRuntimeEnabled,
  createSeededRng,
  seededShuffle,
  resolveActivePrivatePairingRules,
  dedupeEquivalentRules,
  splitHardAndSoftRules,
  evaluateHardPrivatePairingRules,
  scoreSoftPrivatePairingRules,
  generateTeamPairingCandidates,
  createMatchCandidate,
  runPrivatePairingRuntime,
  evaluatePrivatePairingCandidate,
  evaluatePrivatePairingMatchOption,
  loadActiveRulesForLiveScope,
  prepareLivePrivatePairingOptions,
  buildPrivatePairingRuntimeError,
  filterRulesForTeamFormation,
  isTeamFormationConstraintType,
  isExcludedFromTeamFormation,
  filterRulesForOpponentStage,
  filterRulesForGroupStage,
  isOpponentStageConstraintType,
  isGroupStageConstraintType,
  isExcludedFromOpponentStage,
  isExcludedFromGroupStage,
  gateResolvedForStage,
  assignGroupsWithPrivatePairingRules,
  assignOpenGroupsWithPrivatePairingRules,
  buildMatchOptionFromSides,
  evaluateOpponentMatchupCandidate,
  filterAndRankMatchupsByOpponentRules,
  applyOpponentRulesToGroupStageSchedule,
  shareGroup,
  normalizeGroupsToPlayerIds,
  founderCourtPoliciesToLegacyConstraints,
  gatePrivatePairingForRunAi,
  isNoFeasibleAiPairing,
  collectAiPairingRejectionCodes,
} from "./runtime/index.js";

export {
  PRIVATE_PAIRING_DB_CODE,
  PRIVATE_PAIRING_TABLES,
  PRIVATE_PAIRING_RPC,
} from "./constants/dbCodes.js";

export {
  mapDbRuleToCanonical,
  mapDbRuleSetPayload,
} from "./repository/mapDbRuleToCanonical.js";

export {
  setPrivatePairingRpcClientForTests,
  listPrivatePairingRuleSets,
  getPrivatePairingRuleSet,
  getActivePrivatePairingRulesForScope,
  createPrivatePairingRuleSet,
  createPrivatePairingRule as createPrivatePairingRuleViaRpc,
  updatePrivatePairingRule as updatePrivatePairingRuleViaRpc,
  disablePrivatePairingRule as disablePrivatePairingRuleViaRpc,
  clonePrivatePairingRuleSetVersion,
  activatePrivatePairingRuleSet as activatePrivatePairingRuleSetViaRpc,
  archivePrivatePairingRuleSet,
  rollbackPrivatePairingRuleSet,
  listPrivatePairingAuditLogs,
} from "./repository/privatePairingRulesRepository.js";

export {
  buildRuleSetHashPayload,
  computeRuleSetContentHashFromDbRules,
  activatePrivatePairingRuleSetWithPreflight,
  loadActivePrivatePairingRulesForRuntime,
} from "./services/privatePairingRulesService.js";

export {
  CONSTRAINT_TYPE_LABELS,
  SCOPE_LABELS,
  CONSTRAINT_TYPE_GROUPS,
  CONSTRAINT_TYPE_OPTIONS,
  CONSTRAINT_TYPE_OPTIONS_FOR_CREATE,
  RUNTIME_UNSUPPORTED_PRIVATE_CONSTRAINT_TYPES,
  isRuntimeUnsupportedPrivateConstraintType,
  listUnsupportedRuntimeRules,
  getRuntimeSupportedPrivateConstraintTypes,
  filterRules,
  filterRuleSets,
} from "./ui/privatePairingAdminHelpers.js";

export {
  SIMULATION_DEFAULTS,
  SIMULATION_CODE,
  EXPLANATION_CODE,
  SIMULATION_VERSION,
  filterEligibleSimulationPlayers,
  canonicalizeCandidateKey,
  generateSimulationCandidates,
  simulatePrivatePairing,
  SIMULATE_PRIVATE_PAIRING_ACTION,
  buildSimulatePrivatePairingAudit,
} from "./simulation/index.js";
