/**
 * Player Rating Foundation — Phase 1B contracts/ports + Phase 1C read model.
 *
 * Runtime-neutral contracts, ports, and current-state read-model only.
 * Not wired into Production runtime.
 * Does not replace legacy assessment under src/features/player-rating/.
 */

export const PLAYER_RATING_FOUNDATION_PHASE = Object.freeze({
  id: "1B",
  name: "module-skeleton",
  wiredToProductionRuntime: false,
  hasFinalAlgorithm: false,
});

export {
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PlayerRatingFoundationError,
  isPlayerRatingFoundationError,
  isPlayerRatingFoundationErrorCode,
} from "./errors/index.js";

export {
  PLAYER_RATING_SUPPORTED_MODES,
  isSupportedRatingMode,
  requireSupportedRatingMode,
  isExplicitPlayerRatingScope,
  requireExplicitPlayerRatingScope,
  getScopeTenantId,
  createRatingCurrentStateContract,
  isRatingCurrentStateContract,
  createRatingHistoryEntryContract,
  assertHistoryAppendOnly,
  createRatingSnapshotContract,
  assertSnapshotImmutable,
  requireVerificationActorContext,
  createRatingVerificationRequestContract,
  createRatingVerificationResultContract,
  requireAdjustmentActorContext,
  createRatingAdjustmentRequestContract,
  createRatingAdjustmentAuditContract,
  RATING_APPLICATION_IDENTITY_FIELDS,
  createRatingApplicationIdentityContract,
  buildRatingApplicationIdentityKey,
  createRatingReversalIdentityContract,
  buildRatingReversalIdentityKey,
  failContract,
  isNonEmptyString,
  isValidTimestamp,
  requireNonEmptyString,
  requireValidTimestamp,
  deepFreeze,
  clonePlain,
} from "./contracts/index.js";

export {
  throwPortUnimplemented,
  matchesPortMethods,
  CANONICAL_PLAYER_ID_RESOLVER_PORT_METHODS,
  matchesCanonicalPlayerIdResolverPort,
  createUnimplementedCanonicalPlayerIdResolverPort,
  unresolvedCanonicalPlayerIdResult,
  RATING_CURRENT_STATE_PORT_METHODS,
  matchesRatingCurrentStatePort,
  createUnimplementedRatingCurrentStatePort,
  RATING_HISTORY_PORT_METHODS,
  matchesRatingHistoryPort,
  createUnimplementedRatingHistoryPort,
  RATING_SNAPSHOT_PORT_METHODS,
  matchesRatingSnapshotPort,
  createUnimplementedRatingSnapshotPort,
  RATING_VERIFICATION_PORT_METHODS,
  matchesRatingVerificationPort,
  createUnimplementedRatingVerificationPort,
  RATING_ADJUSTMENT_AUDIT_PORT_METHODS,
  matchesRatingAdjustmentAuditPort,
  createUnimplementedRatingAdjustmentAuditPort,
  MATCH_RESULT_RATING_PORT_METHODS,
  matchesMatchResultRatingPort,
  createUnimplementedMatchResultRatingPort,
  MATCH_RESULT_RATING_ALGORITHM,
} from "./ports/index.js";

export {
  PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE,
  PLAYER_RATING_SOURCE_TYPE,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_ID_RESOLUTION_STATUS,
  CONFIDENCE_SCALE,
  NORMALIZABLE_SOURCE_TYPES,
  NON_AUTHORITATIVE_SOURCE_TYPES,
  isKnownPlayerRatingSourceType,
  isNormalizableSourceType,
  isNonAuthoritativeSourceType,
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  PLAYER_RATING_READ_MODEL_REUSED_ERROR_CODE,
  failReadModel,
  isPlayerRatingReadModelErrorCode,
  buildCandidateId,
  candidateSortKey,
  sortCandidatesDeterministically,
  createCurrentStateCandidate,
  optionalFiniteNumber,
  optionalNonEmptyString,
  optionalTimestamp,
  normalizeV2Rating,
  normalizeV5Rating,
  normalizeLegacyRating,
  collectRatingCandidates,
} from "./read-model/index.js";
