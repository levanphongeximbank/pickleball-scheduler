/**
 * Competition Core Draw Runtime Adapter — CC-04D.
 * Importing this module MUST NOT execute draw algorithms or mutate tournament state.
 */

export {
  DRAW_RUNTIME_ADAPTER_VERSION,
  LEGACY_DRAW_RUNTIME_INVENTORY,
  buildDrawRuntimeCallGraph,
  findDrawRuntimeInventoryByFunction,
} from "./drawRuntimeInventory.js";

export {
  mapLegacyDrawPayloadToDrawRequest,
  mapLegacyDrawPayloadToStrategyDrawRequest,
  mapCompetitionEngineInputToDrawRequest,
  cloneLegacyDrawPayload,
  isLegacyDrawPayloadPreserved,
} from "./legacyDrawPayloadMappers.js";

export {
  mapLegacyGroupToDrawGroup,
  mapLegacyGroupsToDrawGroups,
  mapDrawGroupToLegacyGroup,
  mapDrawGroupsToLegacyGroups,
  mapLegacyDrawResultToDrawResult,
  adaptDrawResultForLegacyConsumer,
  mapDrawResultToStrategyDrawResult,
  isLegacyDrawOutputPreserved,
  extractDrawGroupMembership,
} from "./legacyDrawResultMappers.js";

export {
  createDrawDecisionTrace,
  createDrawDecisionTraceRecord,
  appendDrawDecisionTrace,
  buildDrawDecisionPath,
  summarizeDrawDecisionTrace,
} from "./drawDecisionTrace.js";

export {
  resolveDrawEnvSource,
  evaluateCanonicalDraw,
  runLegacyDrawWithCanonicalAdapter,
} from "./drawRuntimeAdapter.js";

export {
  wrapTeamDrawLegacyResult,
  unwrapTeamDrawLegacyResult,
  buildTeamDrawLegacyPayload,
  runTeamDrawWithCanonicalAdapter,
  runDirectTeamDraw,
} from "./teamDrawAdapter.js";

export {
  compareDrawShadowParity,
  runDrawShadowComparison,
} from "./drawShadowParity.js";

export {
  compareSeedShadowParity,
  buildLegacySeedRowsFromOrder,
} from "./seedShadowCompare.js";

export {
  buildCompleteDrawTraceRecord,
  isDrawTraceJsonSerializable,
  validateCompleteDrawTraceRecord,
} from "./drawTraceVerification.js";
