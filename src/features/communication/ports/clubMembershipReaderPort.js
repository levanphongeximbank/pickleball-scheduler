/**
 * ClubMembershipReader — read-only club membership facts (COMMS-03).
 * Communication consumes Club Management SoT; never writes membership.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} ClubMembershipReader
 * @property {(clubId: string, participantId: string) => Promise<object>|object} getMembership
 * @property {(clubId: string, participantId: string) => Promise<boolean>|boolean} isActiveMember
 */

export const CLUB_MEMBERSHIP_READER_METHODS = Object.freeze([
  "getMembership",
  "isActiveMember",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClubMembershipReader(port) {
  return matchesPortMethods(port, CLUB_MEMBERSHIP_READER_METHODS);
}

/**
 * @returns {ClubMembershipReader}
 */
export function createUnimplementedClubMembershipReader() {
  return {
    async getMembership() {
      throwPortUnimplemented("ClubMembershipReader", "getMembership");
    },
    async isActiveMember() {
      throwPortUnimplemented("ClubMembershipReader", "isActiveMember");
    },
  };
}
