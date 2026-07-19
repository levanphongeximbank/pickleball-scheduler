/**
 * MembershipStatusPort — club/org membership requirement checks.
 *
 * @typedef {Object} MembershipStatusPort
 * @property {(args: {
 *   clubId?: string|null,
 *   organizationId?: string|null,
 *   participantId: string,
 * }) => Promise<{
 *   isMember: boolean,
 *   status?: string|null,
 *   reasonCodes?: string[],
 * }>} getMembershipStatus
 */

/**
 * @returns {MembershipStatusPort}
 */
export function createNullMembershipStatusPort() {
  return {
    async getMembershipStatus() {
      return {
        isMember: false,
        status: null,
        reasonCodes: ["MEMBERSHIP_PORT_UNAVAILABLE"],
      };
    },
  };
}

/**
 * @param {(args: any) => any|Promise<any>} [impl]
 * @returns {MembershipStatusPort}
 */
export function createStubMembershipStatusPort(impl) {
  return {
    async getMembershipStatus(args) {
      if (typeof impl === "function") return impl(args);
      return { isMember: true, status: "ACTIVE", reasonCodes: [] };
    },
  };
}

export const MEMBERSHIP_STATUS_PORT_METHODS = Object.freeze(["getMembershipStatus"]);
