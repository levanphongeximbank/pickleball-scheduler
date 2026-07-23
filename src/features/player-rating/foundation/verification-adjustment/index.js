/**
 * Player Rating Foundation — Phase 1E verification & manual adjustment.
 * In-memory adapters are foundation/test only — not Production persistence.
 */

export {
  PLAYER_RATING_CAPABILITY,
  ALLOWED_ADJUSTMENT_FIELDS,
  RATING_OPERATION_TYPE,
  RATING_HISTORY_EVENT_TYPE,
  PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE,
} from "./constants.js";

export {
  authorizeRatingOperation,
  authorizeVerificationActor,
  authorizeAdjustmentActor,
} from "./authorizeRatingOperation.js";

export {
  createRatingOperationIdentity,
  buildRatingOperationIdentityKey,
  ratingOperationIdentitiesEqual,
} from "./createRatingOperationIdentity.js";

export {
  buildCurrentStateKey,
  normalizeStoredCurrentState,
  assertStateIdentityImmutable,
  assertExpectedVersion,
  requireExplicitRatingValue,
  buildAfterState,
  fingerprintPayload,
} from "./stateHelpers.js";

export { createInMemoryRatingCurrentStateAdapter } from "./createInMemoryRatingCurrentStateAdapter.js";

export {
  buildStoredAdjustmentAuditEntry,
  createInMemoryRatingAdjustmentAuditAdapter,
} from "./createInMemoryRatingAdjustmentAuditAdapter.js";

export {
  buildVerificationHistoryEntry,
  buildAdjustmentHistoryEntry,
  buildAdjustmentAuditEntry,
} from "./buildEntries.js";

export { verifyPlayerRating } from "./verifyPlayerRating.js";
export { adjustPlayerRating } from "./adjustPlayerRating.js";
