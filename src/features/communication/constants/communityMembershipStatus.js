/**
 * Community membership status facts consumed via port (COMMS-04).
 * Platform / community ownership remains outside Communication.
 */

export const COMMUNITY_MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REMOVED: "REMOVED",
  NOT_MEMBER: "NOT_MEMBER",
});

export const COMMUNITY_MEMBERSHIP_STATUS_VALUES = Object.freeze(
  Object.values(COMMUNITY_MEMBERSHIP_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCommunityMembershipStatus(value) {
  return COMMUNITY_MEMBERSHIP_STATUS_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isActiveCommunityMembership(value) {
  return value === COMMUNITY_MEMBERSHIP_STATUS.ACTIVE;
}
