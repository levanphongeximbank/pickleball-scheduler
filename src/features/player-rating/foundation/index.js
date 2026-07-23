/**
 * Player Rating Foundation — Phase 1B module skeleton.
 *
 * Runtime-neutral contracts and ports only.
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
