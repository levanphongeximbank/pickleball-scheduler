/**
 * CommunityMembershipReader — read-only community membership facts (COMMS-04).
 * Communication consumes external SoT; never writes membership.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} CommunityMembershipReader
 * @property {(tenantId: string, participantId: string) => Promise<object>|object} getMembership
 * @property {(tenantId: string, participantId: string) => Promise<boolean>|boolean} isActiveMember
 */

export const COMMUNITY_MEMBERSHIP_READER_METHODS = Object.freeze([
  "getMembership",
  "isActiveMember",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityMembershipReader(port) {
  return matchesPortMethods(port, COMMUNITY_MEMBERSHIP_READER_METHODS);
}

/**
 * @returns {CommunityMembershipReader}
 */
export function createUnimplementedCommunityMembershipReader() {
  return {
    async getMembership() {
      throwPortUnimplemented("CommunityMembershipReader", "getMembership");
    },
    async isActiveMember() {
      throwPortUnimplemented("CommunityMembershipReader", "isActiveMember");
    },
  };
}
