/**
 * Phase 3E + CORE-06 Phase 1C — Lineup capability-local public surface.
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  createLineupResolver,
  LineupResolver,
} from "./LineupResolver.js";

export {
  createLegacyLineupAdapter,
  LegacyLineupAdapter,
} from "./adapters/index.js";

export {
  createLineupResolveRequest,
  createLineupResolveResult,
  lineupResolveOk,
  lineupResolveFail,
  LINEUP_ADAPTER_ID,
  isLineupAdapter,
  createLineupPolicyResult,
  isLineupPolicy,
  LINEUP_IDENTITY_KIND,
  buildLineupIdentityKey,
  buildLineupSlotId,
  createLineupIdentity,
  identityFromCompetitionLineup,
  createLineupVisibilityGrant,
  LINEUP_VISIBILITY_STATE,
  LINEUP_VISIBILITY_STATE_VALUES,
  LINEUP_VISIBILITY_RANK,
  isLineupVisibilityState,
  normalizeLineupVisibilityState,
  compareVisibilityRank,
  LINEUP_DEADLINE_PHASE,
  LINEUP_DEADLINE_PHASE_VALUES,
  isLineupDeadlinePhase,
  createLineupDeadlineTimestamps,
  createLineupVisibilityProjection,
  LINEUP_PROJECTION_FIELD,
  isLineupHardeningPolicy,
  createDefaultLineupHardeningPolicy,
  createLineupHardeningPolicy,
  createLineupAuditMetadata,
  createLineupIdempotencyRecord,
  MISSING_LINEUP_POLICY,
  MISSING_LINEUP_POLICY_VALUES,
  MISSING_LINEUP_OUTCOME,
  MISSING_LINEUP_OUTCOME_VALUES,
  createMissingLineupResolution,
  isLineupRandomPolicy,
  createPermissiveLineupRandomPolicy,
  createFixedStrategyLineupRandomPolicy,
  createLineupRandomSelectRequest,
  createLineupRandomSelectResult,
  LINEUP_FORMAT_ADAPTER_KIND,
  LINEUP_FORMAT_ADAPTER_METHODS,
  isLineupFormatAdapter,
  lineupMappingOk,
  lineupMappingFail,
  LINEUP_PERSISTENCE_TX_METHODS,
  LINEUP_PERSISTENCE_GUARANTEES,
  matchesLineupPersistenceTransactionPort,
  LINEUP_SHADOW_CLASSIFICATION,
  LINEUP_SHADOW_CLASSIFICATION_VALUES,
  LINEUP_SHADOW_DIMENSIONS,
  isLineupShadowClassification,
  createShadowDimensionResult,
  LINEUP_CERTIFICATION_VERDICT,
  LINEUP_CERT_AXIS,
  createLineupCertificationReport,
  LINEUP_ACCEPTED_DIFFERENCE_CODE,
  LINEUP_ACCEPTED_DIFFERENCE_CODE_VALUES,
  LINEUP_ACCEPTED_DIFFERENCE_REGISTRY,
  isLineupAcceptedDifferenceCode,
} from "./contracts/index.js";
export {
  LINEUP_RUNTIME_ERROR_CODE,
  LINEUP_RUNTIME_ERROR_CODE_VALUES,
  isLineupRuntimeErrorCode,
  LineupRuntimeError,
  isLineupRuntimeError,
  createLineupRuntimeError,
} from "./errors/index.js";

export {
  LINEUP_SOURCE_TYPE,
  LINEUP_SOURCE_TYPE_VALUES,
  isLineupSourceType,
} from "./enums/index.js";

export {
  mapLegacyLineupStatus,
  LEGACY_LINEUP_STATUS_MAP,
  isLegacyLineupSource,
  mapLegacyLineupToCompetitionLineup,
} from "./mappers/index.js";

export {
  LINEUP_PERSISTENCE_PORT_METHODS,
  matchesLineupPersistencePort,
  createInMemoryLineupPersistencePort,
  createNoopLineupPersistencePort,
  LINEUP_AUTH_ACTION,
  matchesLineupAuthorizationPort,
  createDenyLineupAuthorizationPort,
  createAllowlistLineupAuthorizationPort,
  matchesLineupVisibilityPort,
  createDenyLineupVisibilityPort,
  matchesLineupClockPort,
  createLineupClockPort,
  createFixedLineupClockPort,
  matchesLineupRandomPort,
  createNoopLineupRandomPort,
  createDeterministicLineupRandomPort,
  selectLineupViaPortAlgorithm,
  matchesRosterLookupPort,
  createFailClosedRosterLookupPort,
  createFixedRosterLookupPort,
  matchesLineupAuditPort,
  createNoopLineupAuditPort,
  createLineupAuditPort,
  matchesLineupIdempotencyPort,
  createNoopLineupIdempotencyPort,
  createInMemoryLineupIdempotencyPort,
} from "./ports/index.js";

export {
  createNoopLineupPolicy,
  NOOP_LINEUP_POLICY_ID,
} from "./policies/index.js";

export {
  createLineupIdentityLookup,
  requireLineupIdentity,
  normalizeAndValidateLineup,
  participantToken,
  buildRosterMemberTokenSet,
  assertLineupRosterMembership,
  LINEUP_ACTION,
  LINEUP_IMMUTABLE_STATUSES,
  LINEUP_TRANSITION_MATRIX,
  findLineupTransition,
  assertLineupTransitionAllowed,
  domainIssue,
  sortDomainIssues,
  validateLineupScope,
  validateLineupIdentityDeterminism,
  validateRevisionNumber,
  validateLineupMembershipInvariants,
  validateRevisionImmutability,
  validateLineupInvariants,
  normalizeSlotsWithDeterministicIds,
  createInitialRevision,
  createNextRevision,
  supersedeRevision,
  appendRevisionHistory,
  createLineupDomainService,
  createMissingLineupResolver,
  buildMissingLineupPayloadHash,
  LOCKED_BLOCKED_ACTIONS,
  assertLockedMutationAllowed,
  buildIdempotencyPayloadFingerprint,
  createHardenedLineupIdempotencyPort,
  idempotencyConflictResult,
} from "./services/index.js";

export {
  projectLineupForViewer,
  assertVisibilityTransitionAllowed,
  DEFAULT_VISIBILITY_PROGRESSION,
} from "./visibility/index.js";

export {
  parsePolicyTimeMs,
  resolveExplicitEvaluationTime,
  evaluateDeadlinePhase,
  assertDeadlineAllowsMutation,
} from "./deadlines/index.js";

export {
  assertExpectedVersion,
  buildCommandFingerprint,
  buildResultFingerprint,
} from "./concurrency/index.js";

export { createInMemoryIdempotencyRepository } from "./repositories/index.js";

/** Shadow compare + certification are capability utilities (no Production wiring). */
export { compareLineupShadowResults } from "./shadow/index.js";

export { certifyCore06Phase1F } from "./certification/index.js";

/**
 * Team Tournament compatibility fixtures / TEST_ONLY doubles are NOT re-exported
 * here. Import from `./integration/index.js` (FORMAT_INTEGRATION_API / TEST_ONLY).
 */

export {
  LINEUP_RANDOM_ALGORITHM,
  hashStringToUint32,
  createMulberry32,
  createRngFromMaterial,
  deterministicShuffle,
  CANONICAL_SEED_FIELD_SEP,
  CANONICAL_SEED_FIELDS,
  normalizeSeedPart,
  normalizeSeed,
  composeCanonicalSeed,
  canonicalizeJsonValue,
  serializeCanonical,
  fingerprintValue,
  fingerprintSeed,
  fingerprintInput,
  fingerprintSelection,
  compareCanonicalStrings,
  normalizeRosterCandidates,
  normalizeSlotTemplate,
  selectLineupDeterministic,
} from "./random/index.js";

/** Re-export slot/lineup factories for capability-local consumers (contracts only). */
export {
  createCompetitionLineup,
  createCompetitionLineupSlot,
  createCompetitionLineupRevision,
} from "../participants/contracts/teamRosterLineup.js";
