/**
 * Player Rating privacy projection levels and read capabilities (Phase 1I).
 * Caller-supplied domain context only — not UI role labels or Auth/RBAC runtime.
 */

/** @type {Readonly<{
 *   PUBLIC: string,
 *   PLAYER_SELF: string,
 *   AUTHORIZED_REVIEWER: string,
 *   INTERNAL_SYSTEM: string,
 * }>} */
export const PLAYER_RATING_PRIVACY_PROJECTION_LEVEL = Object.freeze({
  PUBLIC: "PUBLIC",
  PLAYER_SELF: "PLAYER_SELF",
  AUTHORIZED_REVIEWER: "AUTHORIZED_REVIEWER",
  INTERNAL_SYSTEM: "INTERNAL_SYSTEM",
});

/** @type {Readonly<{
 *   READ_SELF: string,
 *   READ_PUBLIC: string,
 *   READ_RESTRICTED: string,
 *   READ_INTERNAL: string,
 *   READ_GLOBAL: string,
 * }>} */
export const PLAYER_RATING_READ_CAPABILITY = Object.freeze({
  READ_SELF: "PLAYER_RATING_READ_SELF",
  READ_PUBLIC: "PLAYER_RATING_READ_PUBLIC",
  READ_RESTRICTED: "PLAYER_RATING_READ_RESTRICTED",
  READ_INTERNAL: "PLAYER_RATING_READ_INTERNAL",
  READ_GLOBAL: "PLAYER_RATING_READ_GLOBAL",
});

/**
 * @param {unknown} level
 * @returns {boolean}
 */
export function isSupportedPrivacyProjectionLevel(level) {
  return Object.values(PLAYER_RATING_PRIVACY_PROJECTION_LEVEL).includes(
    String(level)
  );
}

/**
 * Capability required for a projection level (fail-closed mapping).
 * @param {string} projectionLevel
 * @returns {string}
 */
export function requiredCapabilityForProjectionLevel(projectionLevel) {
  switch (projectionLevel) {
    case PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC:
      return PLAYER_RATING_READ_CAPABILITY.READ_PUBLIC;
    case PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF:
      return PLAYER_RATING_READ_CAPABILITY.READ_SELF;
    case PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER:
      return PLAYER_RATING_READ_CAPABILITY.READ_RESTRICTED;
    case PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM:
      return PLAYER_RATING_READ_CAPABILITY.READ_INTERNAL;
    default:
      return "";
  }
}

export const PLAYER_RATING_SECURITY_PRIVACY_PHASE = Object.freeze({
  id: "1I",
  name: "security-privacy-and-boundary-hardening",
  wiredToProductionRuntime: false,
  isProductionAuthorization: false,
  convertsScales: false,
  selectsRuntimeSsot: false,
  selectsWinner: false,
  calculatesDisplayRating: false,
  hasWriteApi: false,
  generatesIdsOrTimestamps: false,
  importsAuthOrRbacRuntime: false,
});
