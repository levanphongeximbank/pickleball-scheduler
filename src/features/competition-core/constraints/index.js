export {
  RULE_ERROR_CODE,
  RULE_ENGINE_VERSION,
  RULE_SOFT_SCORE,
  RULE_ERROR_TITLES,
  RULE_SUGGESTED_RESOLUTIONS,
  DEFAULT_RULE_SET_ID,
  DEFAULT_RULE_SET_VERSION,
  DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE,
  LEGACY_CONSTRAINT_TYPE_ALIASES,
} from "./ruleConstants.js";

export {
  SUPPORTED_HARD_CONSTRAINT_TYPES,
  SUPPORTED_SOFT_CONSTRAINT_TYPES,
  OPPONENT_GEOMETRY_TYPES,
  GROUP_GEOMETRY_TYPES,
  isConstraintTypeEvaluated,
} from "./constraintSupport.js";

export {
  createRuleSet,
  normalizeRuleSet,
  normalizeRuleDefinition,
  normalizeRuleDefinitions,
} from "./normalizeRule.js";

export { normalizeInput } from "./normalizeInput.js";

export { resolveContext, toRuleEvaluationContext } from "./resolveContext.js";

export { expandApplicableRules, isRuleApplicable } from "./expandApplicableRules.js";

export {
  selectRuleSetVersion,
  validateRuleSetLifecycle,
} from "./selectRuleSetVersion.js";

export {
  detectConstraintConflicts,
  validateRuleSetConflicts,
} from "./detectConflicts.js";

export {
  evaluateHardRules,
  shareTeam,
  shareGroup,
  getPartnerParams,
} from "./evaluateHardRules.js";

export { scoreSoftRules } from "./scoreSoftRules.js";

export {
  validateEligibility,
  validateHardConstraints,
} from "./validateHardConstraints.js";

export { scoreSoftConstraints } from "./scoreSoftConstraints.js";

export { aggregateResult } from "./aggregateResult.js";

export {
  createConstraintExplanation,
  toConstraintExplanation,
  buildExplanation,
} from "./buildExplanation.js";

export {
  evaluateCandidate,
} from "./evaluateCandidate.js";

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
  evaluateLegacyGroupConstraints,
  evaluateLegacyTeamLineupValidation,
  evaluateLegacyCaptainSubmissionValidation,
  evaluateLegacyRefereeMatchEligibility,
  evaluateLegacyTournamentEntryValidation,
  evaluateCanonicalRulesRuntime,
  buildRulesRuntimeCallGraph,
  LEGACY_RULES_RUNTIME_INVENTORY,
  runRulesShadowComparison,
  buildRulesShadowComparison,
  createRulesRuntimeTraceRecord,
  buildCompleteRulesRuntimeTraceRecord,
  validateRulesRuntimeTraceRecord,
  isRulesRuntimeTraceJsonSerializable,
  redactRulesRuntimeTraceSecrets,
  RULES_RUNTIME_ERROR_CODE,
  RULES_DECISION_STATUS,
  mergeValidationResults,
  createDecisionTrace,
  summarizeDecisionTrace,
  RULE_SOURCE_TYPE,
  EVALUATION_OWNER,
  resolveRuleEvaluationOwner,
  buildFounderPolicyDeduplicationPlan,
  buildFounderShadowContributionSummary,
  detectFounderDoubleCount,
  buildRuleSourceIdentity,
  buildDeduplicationKey,
  buildIdentityFromAiPolicy,
  sortedPlayerPairKey,
} from "./adapters/index.js";

export {
  evaluateCanonicalRules,
  preflightRuleSet,
} from "./evaluateCanonicalRules.js";

/* ── CORE-01 Rule Engine Foundation (local barrel only) ── */

export {
  RULE_SOURCE,
  RULE_SOURCE_VALUES,
  RULE_SOURCE_PRIORITY,
  RULE_SOURCE_ORDER,
  isRuleSource,
  deriveRuleSource,
  resolveRuleSourcePriority,
  RULE_PRIORITY,
  RULE_PRIORITY_VALUES,
  RULE_PRIORITY_RANK,
  isRulePriority,
  resolveRulePriorityRank,
  normalizeRuleAuthority,
  compareRuleAuthority,
} from "./authority/index.js";

export {
  RULE_OPERATION,
  RULE_OPERATION_VALUES,
  RULE_OPERATION_ALIASES,
  isRuleOperation,
  resolveCanonicalOperation,
  matchRuleOperation,
} from "./operations/index.js";

export {
  RULE_RESOLUTION_REASON,
  buildRuleResolutionTrace,
  cloneRule,
  resolveApplicableRules,
  resolveCompetitionId,
  resolveRulesDeterministic,
} from "./resolution/index.js";

export {
  createNullParticipantLookupPort,
  createInMemoryParticipantLookupPort,
  createNullEntryLookupPort,
  createInMemoryEntryLookupPort,
  createNullDivisionLookupPort,
  createInMemoryDivisionLookupPort,
} from "./ports/index.js";
