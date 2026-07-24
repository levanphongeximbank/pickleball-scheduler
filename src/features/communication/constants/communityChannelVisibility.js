/**
 * Community channel visibility / access mode (COMMS-04).
 */

export const COMMUNITY_CHANNEL_VISIBILITY = Object.freeze({
  PUBLIC: "PUBLIC",
  JOIN_REQUIRED: "JOIN_REQUIRED",
  RESTRICTED: "RESTRICTED",
  READ_ONLY: "READ_ONLY",
});

export const COMMUNITY_CHANNEL_VISIBILITY_VALUES = Object.freeze(
  Object.values(COMMUNITY_CHANNEL_VISIBILITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCommunityChannelVisibility(value) {
  return COMMUNITY_CHANNEL_VISIBILITY_VALUES.includes(
    /** @type {string} */ (value)
  );
}
