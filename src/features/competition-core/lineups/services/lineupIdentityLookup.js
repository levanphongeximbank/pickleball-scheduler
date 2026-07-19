/**
 * Phase 3E — lineup identity index for collision detection.
 */

import {
  createLineupIdentity,
  identityFromCompetitionLineup,
} from "../contracts/lineupIdentity.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup} a
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup} b
 * @returns {boolean}
 */
function sameLineupPayload(a, b) {
  return (
    a.id === b.id &&
    a.competitionId === b.competitionId &&
    a.teamId === b.teamId &&
    a.contextId === b.contextId &&
    a.status === b.status &&
    a.revision === b.revision &&
    JSON.stringify(a.slots || []) === JSON.stringify(b.slots || [])
  );
}

/**
 * @returns {{
 *   get: (key: string) => import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup|null,
 *   register: (lineup: import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup) => import('../contracts/lineupIdentity.js').LineupIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createLineupIdentityLookup() {
  /** @type {Map<string, import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup>} */
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
    register(lineup) {
      const identity = identityFromCompetitionLineup(lineup);
      if (!identity) {
        throw new LineupRuntimeError(
          LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
          "Cannot derive identity from lineup",
          { lineupId: lineup?.id }
        );
      }
      const existing = byKey.get(identity.key);
      if (existing) {
        if (sameLineupPayload(existing, lineup)) {
          return identity;
        }
        throw new LineupRuntimeError(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_COLLISION,
          "Lineup identity collision — refuse to overwrite",
          {
            identityKey: identity.key,
            existingId: existing.id,
            incomingId: lineup.id,
          }
        );
      }
      byKey.set(identity.key, lineup);
      return createLineupIdentity(identity);
    },
  };
}

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup} lineup
 * @returns {import('../contracts/lineupIdentity.js').LineupIdentity}
 */
export function requireLineupIdentity(lineup) {
  const identity = identityFromCompetitionLineup(lineup);
  if (!identity) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "Lineup missing competition-scoped identity",
      { lineupId: lineup?.id }
    );
  }
  return createLineupIdentity(identity);
}
