/**
 * Stable availability statuses for the read-only Player Rating facade (Phase 1H).
 */

export const PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  NO_RATING_DATA: "NO_RATING_DATA",
  PARTIAL_DATA: "PARTIAL_DATA",
  IDENTITY_CONFLICT: "IDENTITY_CONFLICT",
  INVALID_REQUEST: "INVALID_REQUEST",
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlayerRatingReadFacadeAvailabilityStatus(value) {
  return Object.values(PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS).includes(
    /** @type {string} */ (value)
  );
}
