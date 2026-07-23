/**
 * Phase 1E verification / manual-adjustment constants.
 * Domain-level only — not Production Auth/RBAC.
 */

/** @type {Readonly<{ VERIFY: string, ADJUST: string }>} */
export const PLAYER_RATING_CAPABILITY = Object.freeze({
  VERIFY: "PLAYER_RATING_VERIFY",
  ADJUST: "PLAYER_RATING_ADJUST",
});

/**
 * Manual adjustment may set these fields only.
 * `calculatedRating` and `displayRating` are prohibited:
 * Phase 1A treats calculated as system-derived and display as a projection
 * (`docs/player-rating/phase-1a/04_CURRENT_STATE_HISTORY_AND_SNAPSHOT_CONTRACTS.md`).
 */
export const ALLOWED_ADJUSTMENT_FIELDS = Object.freeze([
  "selfAssessedRating",
  "provisionalRating",
  "verifiedRating",
]);

export const RATING_OPERATION_TYPE = Object.freeze({
  VERIFICATION: "VERIFICATION",
  ADJUSTMENT: "ADJUSTMENT",
});

export const RATING_HISTORY_EVENT_TYPE = Object.freeze({
  VERIFIED: "PLAYER_RATING_VERIFIED",
  ADJUSTED: "PLAYER_RATING_ADJUSTED",
});

export const PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE = Object.freeze({
  id: "1E",
  name: "verification-and-manual-adjustment",
  wiredToProductionRuntime: false,
  isProductionPersistence: false,
  convertsScales: false,
  selectsRuntimeSsot: false,
  hasMatchResultAlgorithm: false,
  generatesIdsOrTimestamps: false,
  importsAuthOrRbacRuntime: false,
});
