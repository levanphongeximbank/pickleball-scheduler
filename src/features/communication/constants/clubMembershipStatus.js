/**
 * Communication-facing club membership facts (COMMS-03).
 * Mapped from Club Management via ClubMembershipReader — not a second SoT.
 */

export const CLUB_MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REMOVED: "REMOVED",
  NOT_MEMBER: "NOT_MEMBER",
});

export const CLUB_MEMBERSHIP_STATUS_VALUES = Object.freeze(
  Object.values(CLUB_MEMBERSHIP_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClubMembershipStatus(value) {
  return CLUB_MEMBERSHIP_STATUS_VALUES.includes(/** @type {string} */ (value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isActiveClubMembership(value) {
  return value === CLUB_MEMBERSHIP_STATUS.ACTIVE;
}
