export {
  FORMATION_RUNTIME_ADAPTER_VERSION,
  LEGACY_FORMATION_RUNTIME_INVENTORY,
  buildFormationRuntimeCallGraph,
  findFormationRuntimeInventoryByFunction,
} from "./formationRuntimeInventory.js";

export {
  createFormationRuntimeDecisionTrace,
  createFormationRuntimeDecisionTraceRecord,
  appendFormationRuntimeDecisionTrace,
  buildFormationDecisionPath,
  summarizeFormationRuntimeDecisionTrace,
} from "./formationDecisionTrace.js";

export {
  mapLegacyFormationPayloadToCanonicalRequest,
  mapLegacyFormationPayloadToPolicy,
  cloneLegacyFormationPayload,
  resolveLegacyFormationRandomFn,
  isLegacyFormationPayloadPreserved,
} from "./legacyFormationPayloadMappers.js";

export {
  mapLegacyFormationResultToFormationResult,
  adaptFormationResultForLegacyConsumer,
  isLegacyFormationOutputPreserved,
  extractFormationTeamMembership,
  mapFormationPairsToLegacyTeams,
  mapLegacyTeamsToFormationCourts,
} from "./legacyFormationResultMappers.js";

export {
  evaluateCanonicalFormation,
  runLegacyFormationWithCanonicalAdapter,
  resolveFormationEnvSource,
} from "./formationRuntimeAdapter.js";

export {
  normalizeFormationPairs,
  comparePairMembership,
  buildFormationParityComparison,
} from "./formationParityModel.js";

export {
  verifyFormationPayloadPreservation,
  extractLegacyPayloadExtensions,
  containsSecretLikeKeys,
} from "./formationPayloadPreservation.js";

export { compareFormationConstraintParity } from "./formationConstraintParity.js";
export { compareFormationScoreParity } from "./formationScoreParity.js";
export {
  extractLegacyCourtAllocation,
  compareFormationCourtParity,
} from "./formationCourtParity.js";

export {
  buildCompleteFormationTraceRecord,
  redactFormationTraceSecrets,
  isFormationTraceJsonSerializable,
  validateCompleteFormationTraceRecord,
} from "./formationTraceVerification.js";

export {
  measureFormationPerformanceBaseline,
  summarizeFormationPerformanceReports,
} from "./formationPerformanceBaseline.js";

export {
  FORMATION_FIXTURE_MATRIX,
  getFormationFixture,
  buildMlpFormationPayload,
} from "./formationFixtures.js";

export {
  createMemoizedFormationExecutor,
  runFormationShadowComparison,
  compareFormationShadowParity,
  verifyFormationRandomParity,
} from "./formationShadowParity.js";

export {
  buildTeamFormationLegacyPayload,
  runTeamFormationWithCanonicalAdapter,
  runDirectTeamFormation,
} from "./teamFormationAdapter.js";
