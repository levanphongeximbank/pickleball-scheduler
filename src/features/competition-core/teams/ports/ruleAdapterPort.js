/**
 * Core-05 — rule adapter port.
 * Default: cross-team membership denied.
 */

/**
 * @typedef {Object} CrossTeamMembershipRequest
 * @property {string} competitionId
 * @property {string|null} [tenantId]
 * @property {string|null} [divisionId]
 * @property {string|null} [divisionCategoryId]
 * @property {string} personToken
 * @property {string} [targetTeamId]
 * @property {string} [existingTeamId]
 */

/**
 * @typedef {Object} TeamRuleAdapter
 * @property {(request: CrossTeamMembershipRequest) => boolean|Promise<boolean>} allowCrossTeamMembership
 */

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function matchesRuleAdapter(adapter) {
  return Boolean(
    adapter &&
      typeof adapter === "object" &&
      typeof adapter.allowCrossTeamMembership === "function"
  );
}

/**
 * @returns {TeamRuleAdapter}
 */
export function createDefaultDenyCrossTeamRuleAdapter() {
  return {
    async allowCrossTeamMembership() {
      return false;
    },
  };
}

/**
 * @param {(request: CrossTeamMembershipRequest) => boolean|Promise<boolean>} predicate
 * @returns {TeamRuleAdapter}
 */
export function createRuleAdapter(predicate) {
  return {
    async allowCrossTeamMembership(request) {
      return Boolean(await predicate(request));
    },
  };
}
