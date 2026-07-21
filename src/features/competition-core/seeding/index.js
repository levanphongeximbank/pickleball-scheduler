/**
 * Competition-core seeding capability-local public surface.
 * Phase 3G runtime exports preserved.
 * CORE-07 Phase 1C/1D/1E/1F exports added (non-production).
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  createSeedingResolver,
  SeedingResolver,
} from "./SeedingResolver.js";

export {
  createLegacySeedingAdapter,
  LegacySeedingAdapter,
} from "./adapters/index.js";

/* Memory/testing adapters are intentionally NOT re-exported from this barrel.
 * Import them only via explicit adapters/memory or adapters/testing subpaths.
 */

export {
  createSeedingResolveRequest,
  createSeedingRequest,
  createSeedingResolveResult,
  seedingResolveOk,
  seedingResolveFail,
  createSeedingResult,
  SEEDING_ADAPTER_ID,
  isSeedingAdapter,
  SEEDING_IDENTITY_KIND,
  SEEDING_CANDIDATE_IDENTITY_KIND,
  SEEDING_ASSIGNMENT_IDENTITY_KIND,
  buildSeedingIdentityKey,
  buildCandidateIdentityKey,
  buildAssignmentIdentityKey,
  createSeedingIdentity,
  createSeedingCandidate,
  createSeedAssignment,
  createSeedingPolicyResult,
  isSeedingPolicy,
} from "./contracts/index.js";

export {
  SEEDING_RUNTIME_ERROR_CODE,
  SEEDING_RUNTIME_ERROR_CODE_VALUES,
  isSeedingRuntimeErrorCode,
  SeedingRuntimeError,
  isSeedingRuntimeError,
  createSeedingRuntimeError,
  SEEDING_ERROR_CATEGORY,
  SEEDING_ERROR_CODE,
  SEEDING_ERROR_CODE_VALUES,
  SEEDING_ERROR_CATEGORY_VALUES,
  SEEDING_ERROR_CODE_CATEGORY,
  isSeedingErrorCode,
  isSeedingErrorCategory,
  SeedingDomainError,
  isSeedingDomainError,
  createSeedingDomainError,
} from "./errors/index.js";

export {
  CANDIDATE_TYPE,
  CANDIDATE_TYPE_VALUES,
  isCandidateType,
  SEEDING_SOURCE_TYPE,
  SEEDING_SOURCE_TYPE_VALUES,
  isSeedingSourceType,
  ASSIGNMENT_REASON,
  ASSIGNMENT_REASON_VALUES,
  isAssignmentReason,
} from "./enums/index.js";

export {
  isLegacySeedingSource,
  mapLegacySeedingToCandidates,
} from "./mappers/index.js";

export {
  SEEDING_PERSISTENCE_PORT_METHODS,
  matchesSeedingPersistencePort,
  createInMemorySeedingPersistencePort,
  createNoopSeedingPersistencePort,
  isFingerprintPort,
  fingerprintCanonicalPayload,
  isEligibilityDecisionPort,
  CORE07_ELIGIBILITY_PORT_VERSION,
  isRuleEvaluationPort,
  CORE07_RULE_EVALUATION_PORT_VERSION,
  isSeedingResultRepositoryPort,
  requireSeedingResultRepositoryPort,
  invokeSeedingResultRepository,
  SEEDING_RESULT_REPOSITORY_PORT_METHODS,
  CORE07_RESULT_REPOSITORY_PORT_VERSION,
  isSeedingLifecycleAuditPort,
  requireSeedingLifecycleAuditPort,
  appendLifecycleEventsThroughPort,
  CORE07_LIFECYCLE_AUDIT_PORT_VERSION,
  isRankingRatingSnapshotProviderPort,
  requireRankingRatingSnapshotProviderPort,
  getSnapshotThroughPort,
  CORE07_SNAPSHOT_PROVIDER_PORT_VERSION,
} from "./ports/index.js";

export {
  createNoopSeedingPolicy,
  NOOP_SEEDING_POLICY_ID,
  normalizeSeedingPolicy,
  normalizeTieBreakSequence,
} from "./policies/index.js";

export {
  deepFreeze,
  deepFreezeClone,
  CORE07_COMPARISON_CONTRACT_VERSION,
  CORE07_SEEDING_CONTRACT_VERSION,
  ENTRY_TYPE,
  ENTRY_TYPE_VALUES,
  ELIGIBILITY_STATUS,
  ELIGIBILITY_STATUS_VALUES,
  PRIMARY_ORDERING_SOURCE,
  PRIMARY_ORDERING_SOURCE_VALUES,
  TIE_BREAK_FIELD,
  TIE_BREAK_FIELD_VALUES,
  SORT_DIRECTION,
  SORT_DIRECTION_VALUES,
  MISSING_VALUE_BEHAVIOUR,
  MISSING_VALUE_BEHAVIOUR_VALUES,
  DEFAULT_FIELD_SORT_DIRECTION,
  SCOPE_PROVENANCE_EXCLUSIONS,
  OVERRIDE_ACTION,
  OVERRIDE_ACTION_VALUES,
  OVERRIDE_STATUS,
  OVERRIDE_STATUS_VALUES,
  AUTHORIZATION_DECISION,
  AUTHORIZATION_DECISION_VALUES,
  MANUAL_OVERRIDE_MODE,
  MANUAL_OVERRIDE_MODE_VALUES,
  ASSIGNMENT_SOURCE,
  ASSIGNMENT_SOURCE_VALUES,
  FINALIZATION_STATE,
  FINALIZATION_STATE_VALUES,
  LIFECYCLE_ACTION,
  LIFECYCLE_ACTION_VALUES,
  LIFECYCLE_EVENT_TYPE,
  LIFECYCLE_EVENT_TYPE_VALUES,
  CORE07_FINGERPRINT_PORT_VERSION,
  CORE07_INTEGRATION_CONTRACT_VERSION,
  normalizeSeedingScope,
  buildSeedingScopeKey,
  normalizeSeedingCandidate,
  normalizeSeedingCandidates,
  normalizeManualSeedOverride,
  normalizeManualSeedOverrides,
  sortOverridesDeterministically,
  createCore07SeedAssignment,
  createCore07DraftSeedingResultDocument,
  normalizeLifecycleAuthorizationDecision,
  normalizeFinalizationRequest,
  normalizeSupersedeRequest,
  normalizeCancellationRequest,
  createLifecycleAuditEvent,
  buildLifecycleEventId,
  cloneSeedingResultWithLifecycle,
} from "./domain/index.js";

export {
  createSeedingIdentityLookup,
  requireSeedingIdentity,
  normalizeCandidates,
  validateCandidates,
  validateManualSeeds,
  compareCandidatesForSeed,
  orderCandidatesDeterministically,
  deterministicOrdering,
  tieBreak,
  assignSeeds,
  hashStringToUint32,
  createMulberry32,
  createDeterministicRandomFromSeed,
  deterministicTieKey,
  buildCandidateOrderingTuple,
  readCandidateOrderingField,
  createDeterministicCandidateComparator,
  orderCandidatesByDeterministicComparator,
  reserveOverrideSeedSlots,
  computeSeedNumberUpperBound,
  allocateSeedNumbers,
  buildAssignmentFingerprintPayload,
  stringifyCanonicalJson,
  buildResultFingerprintPayload,
  createDraftSeedingResult,
  SEEDING_STATE_TRANSITION_MATRIX,
  getSeedingStateTransitionDecision,
  validateSeedingStateTransition,
  finalizeSeedingResult,
  supersedeSeedingResult,
  cancelSeedingResult,
} from "./services/index.js";

export {
  normalizeSeedingIntegrationRequest,
  applyEligibilityDecisions,
  applyRuleEvaluation,
  resolveIntegrationSnapshot,
  projectAuthoritativeSeedingResult,
  mapAuthoritativeProjectionToDrawSeedRanking,
  compareLegacyAndCanonicalSeeding,
  createSeedingIntegrationFacade,
} from "./integration/index.js";
