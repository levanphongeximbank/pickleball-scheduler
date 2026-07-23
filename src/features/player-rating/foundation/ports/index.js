/**
 * Player Rating Foundation ports barrel (Phase 1B).
 */

export {
  throwPortUnimplemented,
  matchesPortMethods,
} from "./portHelpers.js";

export {
  CANONICAL_PLAYER_ID_RESOLVER_PORT_METHODS,
  matchesCanonicalPlayerIdResolverPort,
  createUnimplementedCanonicalPlayerIdResolverPort,
  unresolvedCanonicalPlayerIdResult,
} from "./canonicalPlayerIdResolverPort.js";

export {
  RATING_CURRENT_STATE_PORT_METHODS,
  matchesRatingCurrentStatePort,
  createUnimplementedRatingCurrentStatePort,
} from "./ratingCurrentStatePort.js";

export {
  RATING_HISTORY_PORT_METHODS,
  matchesRatingHistoryPort,
  createUnimplementedRatingHistoryPort,
} from "./ratingHistoryPort.js";

export {
  RATING_SNAPSHOT_PORT_METHODS,
  matchesRatingSnapshotPort,
  createUnimplementedRatingSnapshotPort,
} from "./ratingSnapshotPort.js";

export {
  RATING_VERIFICATION_PORT_METHODS,
  matchesRatingVerificationPort,
  createUnimplementedRatingVerificationPort,
} from "./ratingVerificationPort.js";

export {
  RATING_ADJUSTMENT_AUDIT_PORT_METHODS,
  matchesRatingAdjustmentAuditPort,
  createUnimplementedRatingAdjustmentAuditPort,
} from "./ratingAdjustmentAuditPort.js";

export {
  MATCH_RESULT_RATING_PORT_METHODS,
  matchesMatchResultRatingPort,
  createUnimplementedMatchResultRatingPort,
  MATCH_RESULT_RATING_ALGORITHM,
} from "./matchResultRatingPort.js";
