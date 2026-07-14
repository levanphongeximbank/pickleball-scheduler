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
  evaluateHardPrivatePairingRules,
  scoreSoftPrivatePairingRules,
  generateTeamPairingCandidates,
  createMatchCandidate,
  runPrivatePairingRuntime,
  evaluatePrivatePairingCandidate,
  evaluatePrivatePairingMatchOption,
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
  filterRules,
  filterRuleSets,
} from "./ui/privatePairingAdminHelpers.js";
