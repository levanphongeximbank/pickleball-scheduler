/**
 * Canonical direct conversation pair (COMMS-02).
 * Ordering is deterministic by participant id — independent of who initiates.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createParticipantId } from "./identifiers.js";
import { deepFreeze, failContract } from "./shared.js";

/**
 * @typedef {Object} DirectPairContract
 * @property {string} participantIdA — lexicographically lower id
 * @property {string} participantIdB — lexicographically higher id
 * @property {string} pairKey — deterministic opaque key for the pair
 */

/**
 * Build a canonical ordered pair from any two participant identifiers.
 *
 * @param {unknown} leftParticipantId
 * @param {unknown} rightParticipantId
 * @returns {Readonly<DirectPairContract>}
 */
export function createDirectPairContract(
  leftParticipantId,
  rightParticipantId
) {
  const left = createParticipantId(leftParticipantId);
  const right = createParticipantId(rightParticipantId);

  if (left === right) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED,
      "Direct conversation requires two distinct participants",
      {
        participantId: left,
        reasonCode: "SELF_CONVERSATION",
      }
    );
  }

  const [participantIdA, participantIdB] =
    left < right ? [left, right] : [right, left];

  return deepFreeze({
    participantIdA,
    participantIdB,
    pairKey: buildDirectPairKey(participantIdA, participantIdB),
  });
}

/**
 * Deterministic pair key from already-ordered ids.
 * @param {string} participantIdA
 * @param {string} participantIdB
 * @returns {string}
 */
export function buildDirectPairKey(participantIdA, participantIdB) {
  return `${participantIdA}\u0000${participantIdB}`;
}

/**
 * @param {Readonly<DirectPairContract>} pair
 * @param {string} participantId
 * @returns {boolean}
 */
export function isDirectPairMember(pair, participantId) {
  const id = createParticipantId(participantId);
  return pair.participantIdA === id || pair.participantIdB === id;
}

/**
 * @param {Readonly<DirectPairContract>} pair
 * @param {string} participantId
 * @returns {string}
 */
export function getDirectPairCounterpart(pair, participantId) {
  const id = createParticipantId(participantId);
  if (pair.participantIdA === id) return pair.participantIdB;
  if (pair.participantIdB === id) return pair.participantIdA;
  failContract(
    COMMUNICATION_FOUNDATION_ERROR_CODE.DIRECT_PAIR_INVALID,
    "Participant is not a member of the direct pair",
    { participantId: id, pairKey: pair.pairKey }
  );
}
