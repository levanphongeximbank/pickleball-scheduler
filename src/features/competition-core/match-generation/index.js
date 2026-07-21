/**
 * CORE-09 Match Generator — capability-local public surface.
 * Integrator owns root competition-core/index.js — do not edit that here.
 * Phase 1B: domain contracts, ports, validators, determinism policy.
 * Phase 1C: ROUND_ROBIN + GROUP_ROUND_ROBIN MatchPlan executors (dormant).
 * Phase 1D: SINGLE_ELIMINATION MatchPlan executor (dormant).
 * No production UI / persistence / SQL / runtime wiring.
 */

export {
  MATCH_GENERATION_SCHEMA_VERSION,
  MATCH_GENERATOR_IDENTITY,
  FORBIDDEN_MATCH_PLAN_FIELDS,
} from "./constants.js";

export {
  MATCH_GENERATION_STRATEGY,
  DEFERRED_MATCH_GENERATION_STRATEGY,
  MATCH_GENERATION_STRATEGY_VALUES,
  DEFERRED_MATCH_GENERATION_STRATEGY_VALUES,
  isMatchGenerationStrategy,
  isDeferredMatchGenerationStrategy,
  resolveSupportedStrategy,
  MATCH_DEPENDENCY_TYPE,
  MATCH_DEPENDENCY_TYPE_VALUES,
  isMatchDependencyType,
  PARTICIPANT_SLOT_KIND,
  PARTICIPANT_SLOT_KIND_VALUES,
  isParticipantSlotKind,
  MATCH_GENERATION_ISSUE_SEVERITY,
  MATCH_GENERATION_ISSUE_SEVERITY_VALUES,
  isMatchGenerationIssueSeverity,
} from "./enums/index.js";

export {
  MATCH_GENERATION_ISSUE_CODE,
  MATCH_GENERATION_ISSUE_CODE_VALUES,
  isMatchGenerationIssueCode,
  MatchGenerationContractError,
  isMatchGenerationContractError,
} from "./errors/index.js";

export {
  createMatchGenerationIssue,
  createMatchDependency,
  createParticipantSlot,
  createByeParticipantSlot,
  createLogicalMatch,
  DRAW_COMPLETION_STATUS,
  DRAW_COMPLETION_STATUS_VALUES,
  createDrawPlacementRef,
  createDrawSnapshot,
  ROUND_ROBIN_MODE,
  ROUND_ROBIN_MODE_VALUES,
  BYE_POLICY,
  BYE_POLICY_VALUES,
  BRACKET_SIZE_POLICY,
  BRACKET_SIZE_POLICY_VALUES,
  THIRD_PLACE_POLICY,
  THIRD_PLACE_POLICY_VALUES,
  createEvaluatedMatchGenerationRules,
  createParticipantSnapshotRef,
  createMatchGenerationRequest,
  createMatchGenerationContext,
  createMatchPlanStage,
  createMatchPlanRound,
  createMatchPlan,
  createMatchGenerationResult,
  matchGenerationOk,
  matchGenerationFail,
  collectForbiddenFieldPaths,
  hasForbiddenSchedulingFields,
} from "./contracts/index.js";

export {
  DRAW_RESULT_PORT_METHODS,
  matchesDrawResultPort,
  createFailClosedDrawResultPort,
  createFixedDrawResultPort,
  MATCH_GENERATION_RULE_PORT_METHODS,
  matchesMatchGenerationRulePort,
  createFailClosedMatchGenerationRulePort,
  createFixedMatchGenerationRulePort,
} from "./ports/index.js";

export {
  buildLogicalMatchKey,
  isWellFormedLogicalMatchKey,
  parseLogicalMatchKey,
  encodeRequiredSegment,
  encodeOptionalSegment,
  LOGICAL_MATCH_KEY_VERSION,
  asciiCompare,
  sortMatchGenerationIssues,
  hashStringToUint32,
  canonicalizeJsonValue,
  serializeCanonical,
  fingerprintValue,
  fingerprintGeneration,
  projectMatchPlanForFingerprint,
  fingerprintMatchPlan,
  validateDrawSnapshotForGeneration,
  validateDrawSnapshotNotMutated,
  validateMatchGenerationRequest,
  detectDependencyCycle,
  validateMatchPlanInvariants,
  assertMatchPlanValid,
  rejectUnsupportedStrategy,
  DETERMINISM_POLICY,
  findForbiddenNondeterminismPatterns,
  deepFreezeCanonical,
  freezeMetadata,
  resolveFlatParticipantsFromDraw,
  resolveGroupedParticipantsFromDraw,
  validateRoundRobinRuleBinding,
  resolveRoundRobinLegs,
  PHASE_1C_EXECUTABLE_STRATEGIES,
  validateSingleEliminationRuleBinding,
  PHASE_1D_EXECUTABLE_STRATEGIES,
  PHASE_1D_BRACKET_SIZE_POLICIES,
  PHASE_1D_BYE_POLICIES,
  validateSingleEliminationBracketInvariants,
  generateMatchPlan,
  generateRoundRobinMatchPlan,
  generateGroupStageRoundRobinMatchPlan,
  generateSingleEliminationMatchPlan,
} from "./services/index.js";

export {
  generateCircleRoundRobinPairings,
  expectedSingleRoundRobinPlayedMatches,
  expectedSingleRoundRobinRounds,
  generateRoundRobinForParticipants,
  assembleMatchPlan,
  isPowerOfTwo,
  nextPowerOfTwo,
  computeSingleEliminationBracket,
  expectedLogicalMatchCount,
  expectedPlayedMatchCount,
  openingSlotPositions,
  priorChampionshipFeeders,
  resolveBracketSlotsFromDraw,
  materializeOpeningRoundMatches,
  buildEliminationDependencyGraph,
  generateSingleEliminationForParticipants,
  countDrawParticipants,
} from "./generators/index.js";
