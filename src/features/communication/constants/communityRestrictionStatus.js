/**
 * Community-owned restriction statuses (COMMS-04).
 * Communication-local moderation evidence — not Platform Core SoT.
 */

export const COMMUNITY_RESTRICTION_STATUS = Object.freeze({
  NONE: "NONE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
});

export const COMMUNITY_RESTRICTION_STATUS_VALUES = Object.freeze(
  Object.values(COMMUNITY_RESTRICTION_STATUS)
);

export const COMMUNITY_RESTRICTION_SCOPE = Object.freeze({
  COMMUNITY: "COMMUNITY",
  CHANNEL: "CHANNEL",
});

export const COMMUNITY_RESTRICTION_SCOPE_VALUES = Object.freeze(
  Object.values(COMMUNITY_RESTRICTION_SCOPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCommunityRestrictionStatus(value) {
  return COMMUNITY_RESTRICTION_STATUS_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCommunityRestrictionScope(value) {
  return COMMUNITY_RESTRICTION_SCOPE_VALUES.includes(
    /** @type {string} */ (value)
  );
}
