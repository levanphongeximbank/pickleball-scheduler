/**
 * Phase 3B — identity index for collision detection.
 * No silent merge on collision.
 */

import {
  createParticipantIdentity,
  identityFromCompetitionParticipant,
} from "../../contracts/identity.js";
import { PARTICIPANT_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { ParticipantRuntimeError } from "../errors/ParticipantRuntimeError.js";

/**
 * @param {import('../../contracts/competitionParticipant.js').CompetitionParticipant} a
 * @param {import('../../contracts/competitionParticipant.js').CompetitionParticipant} b
 * @returns {boolean}
 */
function sameIdentityPayload(a, b) {
  return (
    a.id === b.id &&
    a.competitionId === b.competitionId &&
    a.person?.kind === b.person?.kind &&
    a.person?.id === b.person?.id
  );
}

/**
 * @returns {{
 *   get: (key: string) => import('../../contracts/competitionParticipant.js').CompetitionParticipant|null,
 *   register: (participant: import('../../contracts/competitionParticipant.js').CompetitionParticipant) => import('../../contracts/identity.js').ParticipantIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createIdentityLookup() {
  /** @type {Map<string, import('../../contracts/competitionParticipant.js').CompetitionParticipant>} */
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
    /**
     * Register participant by identity key.
     * Same key + same payload → idempotent return.
     * Same key + different payload → IDENTITY_COLLISION (no merge).
     */
    register(participant) {
      const identity = identityFromCompetitionParticipant(participant);
      if (!identity) {
        throw new ParticipantRuntimeError(
          PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
          "Cannot derive identity from participant",
          {}
        );
      }
      const existing = byKey.get(identity.key);
      if (existing) {
        if (sameIdentityPayload(existing, participant)) {
          return identity;
        }
        throw new ParticipantRuntimeError(
          PARTICIPANT_RUNTIME_ERROR_CODE.IDENTITY_COLLISION,
          "Identity collision — refuse to merge",
          {
            identityKey: identity.key,
            existingId: existing.id,
            incomingId: participant.id,
            existingKind: existing.person?.kind,
            incomingKind: participant.person?.kind,
          }
        );
      }
      byKey.set(identity.key, participant);
      return identity;
    },
  };
}

/**
 * @param {import('../../contracts/competitionParticipant.js').CompetitionParticipant} participant
 * @returns {import('../../contracts/identity.js').ParticipantIdentity}
 */
export function requireParticipantIdentity(participant) {
  const identity = identityFromCompetitionParticipant(participant);
  if (!identity) {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
      "Participant missing competition-scoped identity",
      { participantId: participant?.id }
    );
  }
  return createParticipantIdentity(identity);
}
