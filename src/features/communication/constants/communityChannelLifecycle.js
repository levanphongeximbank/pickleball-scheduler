/**
 * Community channel lifecycle (aggregate metadata; COMMS-04).
 * Distinct from conversation.status — allows SUSPENDED without forking COMMS-01.
 */

export const COMMUNITY_CHANNEL_LIFECYCLE = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
});

export const COMMUNITY_CHANNEL_LIFECYCLE_VALUES = Object.freeze(
  Object.values(COMMUNITY_CHANNEL_LIFECYCLE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCommunityChannelLifecycle(value) {
  return COMMUNITY_CHANNEL_LIFECYCLE_VALUES.includes(
    /** @type {string} */ (value)
  );
}
