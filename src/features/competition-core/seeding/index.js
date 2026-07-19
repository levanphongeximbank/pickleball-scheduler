/**
 * Phase 3G — Seeding Runtime (capability-local public surface).
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
} from "./policies/index.js";

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
} from "./services/index.js";
