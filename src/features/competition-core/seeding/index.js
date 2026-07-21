/**
 * Competition-core seeding capability-local public surface.
 * Phase 3G runtime exports preserved.
 * CORE-07 Phase 1C domain / policy / comparator exports added (non-production).
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
  normalizeSeedingScope,
  buildSeedingScopeKey,
  normalizeSeedingCandidate,
  normalizeSeedingCandidates,
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
} from "./services/index.js";
