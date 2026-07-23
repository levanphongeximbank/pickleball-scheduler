/**
 * Player Rating Foundation contract barrel (Phase 1B).
 */

export {
  PLAYER_RATING_SUPPORTED_MODES,
  isSupportedRatingMode,
  requireSupportedRatingMode,
} from "./ratingModes.js";

export {
  isExplicitPlayerRatingScope,
  requireExplicitPlayerRatingScope,
  getScopeTenantId,
} from "./scopeContract.js";

export {
  createRatingCurrentStateContract,
  isRatingCurrentStateContract,
} from "./currentStateContract.js";

export {
  createRatingHistoryEntryContract,
  assertHistoryAppendOnly,
} from "./historyContract.js";

export {
  createRatingSnapshotContract,
  assertSnapshotImmutable,
} from "./snapshotContract.js";

export {
  requireVerificationActorContext,
  createRatingVerificationRequestContract,
  createRatingVerificationResultContract,
} from "./verificationContract.js";

export {
  requireAdjustmentActorContext,
  createRatingAdjustmentRequestContract,
  createRatingAdjustmentAuditContract,
} from "./adjustmentContract.js";

export {
  RATING_APPLICATION_IDENTITY_FIELDS,
  createRatingApplicationIdentityContract,
  buildRatingApplicationIdentityKey,
} from "./idempotencyContract.js";

export {
  createRatingReversalIdentityContract,
  buildRatingReversalIdentityKey,
} from "./reversalContract.js";

export {
  failContract,
  isNonEmptyString,
  isValidTimestamp,
  requireNonEmptyString,
  requireValidTimestamp,
  deepFreeze,
  clonePlain,
} from "./shared.js";
