/**
 * ClubMembershipPort — read-only club membership checks (COMMS-01).
 * Does not write Club membership / governance.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} ClubMembershipPort
 * @property {(clubId: string, authUserId: string) => Promise<boolean>} isActiveMember
 * @property {(clubId: string) => Promise<object|null>} getClubSummary
 */

export const CLUB_MEMBERSHIP_PORT_METHODS = Object.freeze([
  "isActiveMember",
  "getClubSummary",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClubMembershipPort(port) {
  return matchesPortMethods(port, CLUB_MEMBERSHIP_PORT_METHODS);
}

/**
 * @returns {ClubMembershipPort}
 */
export function createUnimplementedClubMembershipPort() {
  return {
    async isActiveMember() {
      throwPortUnimplemented("ClubMembershipPort", "isActiveMember");
    },
    async getClubSummary() {
      throwPortUnimplemented("ClubMembershipPort", "getClubSummary");
    },
  };
}
