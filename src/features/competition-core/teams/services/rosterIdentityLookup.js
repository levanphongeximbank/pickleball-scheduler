/**
 * Phase 3D — roster identity index for collision detection.
 */

import {
  createRosterIdentity,
  identityFromCompetitionRoster,
} from "../contracts/rosterIdentity.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster} a
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster} b
 * @returns {boolean}
 */
function sameRosterPayload(a, b) {
  return (
    a.id === b.id &&
    a.competitionId === b.competitionId &&
    a.teamId === b.teamId &&
    a.status === b.status &&
    (a.members || []).length === (b.members || []).length
  );
}

/**
 * @returns {{
 *   get: (key: string) => import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster|null,
 *   register: (roster: import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster) => import('../contracts/rosterIdentity.js').RosterIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createRosterIdentityLookup() {
  /** @type {Map<string, import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster>} */
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
    register(roster) {
      const identity = identityFromCompetitionRoster(roster);
      if (!identity) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
          "Cannot derive identity from roster",
          { rosterId: roster?.id, teamId: roster?.teamId }
        );
      }
      const existing = byKey.get(identity.key);
      if (existing) {
        if (sameRosterPayload(existing, roster)) {
          return identity;
        }
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODE.ROSTER_IDENTITY_COLLISION,
          "Roster identity collision — refuse to overwrite",
          {
            identityKey: identity.key,
            existingId: existing.id,
            incomingId: roster.id,
            existingTeamId: existing.teamId,
            incomingTeamId: roster.teamId,
          }
        );
      }
      byKey.set(identity.key, roster);
      return createRosterIdentity(identity);
    },
  };
}

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster} roster
 * @returns {import('../contracts/rosterIdentity.js').RosterIdentity}
 */
export function requireRosterIdentity(roster) {
  const identity = identityFromCompetitionRoster(roster);
  if (!identity) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "Roster missing competition-scoped identity",
      { rosterId: roster?.id, teamId: roster?.teamId }
    );
  }
  return createRosterIdentity(identity);
}
