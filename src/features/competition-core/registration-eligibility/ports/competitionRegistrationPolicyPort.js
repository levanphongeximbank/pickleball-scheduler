/**
 * CompetitionRegistrationPolicyPort — competition-level windows / capacity policy.
 *
 * @typedef {Object} CompetitionRegistrationPolicyPort
 * @property {(competitionId: string) => Promise<{
 *   competitionId: string,
 *   windowOpen: boolean,
 *   competitionLimit?: number|null,
 *   allowWaitlist?: boolean,
 *   formatHint?: string|null,
 *   policyRef?: string|null,
 * }>} getRegistrationPolicy
 */

/**
 * @returns {CompetitionRegistrationPolicyPort}
 */
export function createNullCompetitionRegistrationPolicyPort() {
  return {
    async getRegistrationPolicy() {
      return {
        competitionId: "",
        windowOpen: false,
        competitionLimit: null,
        allowWaitlist: false,
        formatHint: null,
        policyRef: null,
      };
    },
  };
}

/**
 * @param {Record<string, any>} [byCompetitionId]
 * @returns {CompetitionRegistrationPolicyPort}
 */
export function createInMemoryCompetitionRegistrationPolicyPort(byCompetitionId = {}) {
  return {
    async getRegistrationPolicy(competitionId) {
      const id = String(competitionId || "");
      if (!id) {
        throw new TypeError("competitionId is required");
      }
      const found = byCompetitionId[id];
      if (!found) {
        return {
          competitionId: id,
          windowOpen: false,
          competitionLimit: null,
          allowWaitlist: false,
          formatHint: null,
          policyRef: null,
        };
      }
      return { competitionId: id, ...found };
    },
  };
}

export const COMPETITION_REGISTRATION_POLICY_PORT_METHODS = Object.freeze([
  "getRegistrationPolicy",
]);
