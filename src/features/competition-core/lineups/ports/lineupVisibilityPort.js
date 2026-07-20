/**
 * CORE-06 Phase 1C — LineupVisibilityPort (contract + deny-all double).
 */

import { createLineupVisibilityGrant } from "../contracts/visibilityGrant.js";

/**
 * @typedef {Object} LineupVisibilityRequest
 * @property {string} actorId
 * @property {string|null} [actorRole]
 * @property {string} competitionId
 * @property {string} contextId
 * @property {string} teamId
 * @property {unknown} [lineup]
 * @property {Record<string, unknown>} [context]
 */

/**
 * @typedef {Object} LineupVisibilityPort
 * @property {(request: LineupVisibilityRequest) => import('../contracts/visibilityGrant.js').LineupVisibilityGrant|Promise<import('../contracts/visibilityGrant.js').LineupVisibilityGrant>} resolveGrant
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupVisibilityPort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.resolveGrant === "function"
  );
}

/**
 * Fail-closed: never reveal opponent selections by default.
 * @returns {LineupVisibilityPort}
 */
export function createDenyLineupVisibilityPort() {
  return {
    async resolveGrant(request) {
      return createLineupVisibilityGrant({
        actorId: request?.actorId,
        actorRole: request?.actorRole,
        competitionId: request?.competitionId,
        contextId: request?.contextId,
        teamId: request?.teamId,
        visible: false,
        reason: "visibility_denied_default",
        lineupId:
          request?.lineup && typeof request.lineup === "object"
            ? /** @type {{ id?: string }} */ (request.lineup).id
            : null,
        identityKey:
          request?.lineup && typeof request.lineup === "object"
            ? /** @type {{ identityKey?: string }} */ (request.lineup)
                .identityKey
            : null,
      });
    },
  };
}
