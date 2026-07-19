/**
 * Phase 3F — match identity index for collision detection.
 */

import {
  createMatchIdentity,
  identityFromCompetitionMatch,
} from "../contracts/matchIdentity.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";

/**
 * @param {import('../contracts/competitionMatch.js').CompetitionMatch} a
 * @param {import('../contracts/competitionMatch.js').CompetitionMatch} b
 * @returns {boolean}
 */
function sameMatchPayload(a, b) {
  return (
    a.id === b.id &&
    a.competitionId === b.competitionId &&
    a.contextId === b.contextId &&
    a.status === b.status &&
    a.revision === b.revision &&
    a.completionReason === b.completionReason &&
    JSON.stringify(a.sides || []) === JSON.stringify(b.sides || []) &&
    JSON.stringify(a.resultReference) === JSON.stringify(b.resultReference)
  );
}

/**
 * @returns {{
 *   get: (key: string) => import('../contracts/competitionMatch.js').CompetitionMatch|null,
 *   register: (match: import('../contracts/competitionMatch.js').CompetitionMatch) => import('../contracts/matchIdentity.js').MatchIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createMatchIdentityLookup() {
  /** @type {Map<string, import('../contracts/competitionMatch.js').CompetitionMatch>} */
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
    register(match) {
      const identity = identityFromCompetitionMatch(match);
      if (!identity) {
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
          "Cannot derive identity from match",
          { matchId: match?.id }
        );
      }
      const existing = byKey.get(identity.key);
      if (existing) {
        if (sameMatchPayload(existing, match)) {
          return identity;
        }
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_IDENTITY_COLLISION,
          "Match identity collision — refuse to overwrite",
          {
            identityKey: identity.key,
            existingId: existing.id,
            incomingId: match.id,
          }
        );
      }
      byKey.set(identity.key, match);
      return createMatchIdentity(identity);
    },
  };
}

/**
 * @param {import('../contracts/competitionMatch.js').CompetitionMatch} match
 * @returns {import('../contracts/matchIdentity.js').MatchIdentity}
 */
export function requireMatchIdentity(match) {
  const identity = identityFromCompetitionMatch(match);
  if (!identity) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "Match missing competition-scoped identity",
      { matchId: match?.id }
    );
  }
  return createMatchIdentity(identity);
}
