/**
 * Competition Core Canonical Daily Matchmaking — CC-06.
 * Importing this module MUST NOT execute runAI or mutate session state.
 */

export {
  MATCHMAKING_ENGINE_VERSION,
  DEFAULT_MATCHMAKING_RULE_SET_VERSION,
  MATCHMAKING_STRATEGY,
  MATCHMAKING_STRATEGY_VALUES,
  isMatchmakingStrategy,
  DEFAULT_MATCHMAKING_SCORE_WEIGHTS,
} from "./matchmakingConstants.js";

export {
  LEGACY_MATCHMAKING_STRATEGY_INVENTORY,
  mapLegacyMatchmakingStrategyToCanonical,
  getMatchmakingStrategyFromCatalog,
} from "./legacyMatchmakingMapping.js";

export {
  createMatchmakingPolicy,
  createMatchmakingCourtAssignment,
  createMatchmakingScoreBreakdown,
  createMatchmakingAudit,
  createMatchmakingRequest,
  createMatchmakingResult,
  validateMatchmakingRequestShape,
  validateMatchmakingResultShape,
  cloneMatchmakingRequest,
  serializeMatchmakingContract,
} from "./matchmakingContracts.js";

export {
  mapLegacyMatchmakingPayloadToMatchmakingRequest,
  cloneLegacyMatchmakingPayload,
  isMatchmakingEngineType,
} from "./matchmakingMappers.js";

export {
  MATCHMAKING_RUNTIME_ADAPTER_VERSION,
  LEGACY_MATCHMAKING_RUNTIME_INVENTORY,
  buildMatchmakingRuntimeCallGraph,
  evaluateCanonicalMatchmaking,
  runLegacyMatchmakingWithCanonicalAdapter,
  runDailyMatchmakingWithCanonicalAdapter,
  runDirectDailyMatchmaking,
  runMatchmakingShadowComparison,
  compareMatchmakingShadowParity,
  verifyMatchmakingRandomParity,
  verifyMatchmakingPayloadPreservation,
  buildMatchmakingParityComparison,
  buildCompleteMatchmakingTraceRecord,
  validateCompleteMatchmakingTraceRecord,
  isMatchmakingTraceJsonSerializable,
  redactMatchmakingTraceSecrets,
  isLegacyMatchmakingOutputPreserved,
  mapLegacyMatchmakingResultToMatchmakingResult,
  buildMatchmakingDecisionPath,
} from "./adapters/index.js";
