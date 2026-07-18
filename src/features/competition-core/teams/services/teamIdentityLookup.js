/**
 * Phase 3D — team identity index for collision detection.
 */

import {
  createTeamIdentity,
  identityFromCompetitionTeam,
} from "../contracts/teamIdentity.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam} a
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam} b
 * @returns {boolean}
 */
function sameTeamPayload(a, b) {
  return (
    a.id === b.id &&
    a.competitionId === b.competitionId &&
    a.name === b.name &&
    a.status === b.status
  );
}

/**
 * @returns {{
 *   get: (key: string) => import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam|null,
 *   register: (team: import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam) => import('../contracts/teamIdentity.js').TeamIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createTeamIdentityLookup() {
  /** @type {Map<string, import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam>} */
  const byKey = new Map();

  return {
    get(key) {
      return byKey.get(String(key)) ?? null;
    },
    has(key) {
      return byKey.has(String(key));
    },
    size() {
      return byKey.size;
    },
    clear() {
      byKey.clear();
    },
    register(team) {
      const identity = identityFromCompetitionTeam(team);
      if (!identity) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
          "Cannot derive identity from team",
          { teamId: team?.id }
        );
      }
      const existing = byKey.get(identity.key);
      if (existing) {
        if (sameTeamPayload(existing, team)) {
          return identity;
        }
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODE.TEAM_IDENTITY_COLLISION,
          "Team identity collision — refuse to overwrite",
          {
            identityKey: identity.key,
            existingId: existing.id,
            incomingId: team.id,
          }
        );
      }
      byKey.set(identity.key, team);
      return createTeamIdentity(identity);
    },
  };
}

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam} team
 * @returns {import('../contracts/teamIdentity.js').TeamIdentity}
 */
export function requireTeamIdentity(team) {
  const identity = identityFromCompetitionTeam(team);
  if (!identity) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "Team missing competition-scoped identity",
      { teamId: team?.id }
    );
  }
  return createTeamIdentity(identity);
}
