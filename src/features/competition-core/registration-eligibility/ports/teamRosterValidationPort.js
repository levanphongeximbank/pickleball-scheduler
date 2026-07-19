/**
 * TeamRosterValidationPort — roster shape checks for TEAM targets.
 * Does not embed Team Tournament format rules.
 *
 * @typedef {Object} TeamRosterValidationPort
 * @property {(args: {
 *   competitionId: string,
 *   teamId: string,
 *   divisionId?: string|null,
 * }) => Promise<{
 *   valid: boolean,
 *   reasonCodes: string[],
 *   memberCount?: number|null,
 * }>} validateRoster
 */

/**
 * @returns {TeamRosterValidationPort}
 */
export function createNullTeamRosterValidationPort() {
  return {
    async validateRoster() {
      return {
        valid: false,
        reasonCodes: ["TEAM_ROSTER_PORT_UNAVAILABLE"],
        memberCount: null,
      };
    },
  };
}

/**
 * @param {(args: any) => any|Promise<any>} [impl]
 * @returns {TeamRosterValidationPort}
 */
export function createStubTeamRosterValidationPort(impl) {
  return {
    async validateRoster(args) {
      if (typeof impl === "function") return impl(args);
      return { valid: true, reasonCodes: [], memberCount: 0 };
    },
  };
}

export const TEAM_ROSTER_VALIDATION_PORT_METHODS = Object.freeze(["validateRoster"]);
