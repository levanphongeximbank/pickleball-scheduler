/**
 * User blocking contract — messaging reachability only (COMMS-01).
 * Not Identity suspension / Club removal.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createParticipantId,
  requireOpaqueId,
} from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} UserBlockContract
 * @property {string} blockId
 * @property {string} blockerParticipantId
 * @property {string} blockedParticipantId
 * @property {string|number} createdAt
 * @property {string|null} reason
 */

/**
 * @param {object} input
 * @returns {Readonly<UserBlockContract>}
 */
export function createUserBlockContract(input = {}) {
  const blockId = requireOpaqueId(input.blockId, "blockId");
  const blockerParticipantId = createParticipantId(input.blockerParticipantId);
  const blockedParticipantId = createParticipantId(input.blockedParticipantId);
  if (blockerParticipantId === blockedParticipantId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_USER_BLOCK,
      "A participant cannot block themselves",
      { blockerParticipantId, blockedParticipantId }
    );
  }
  const createdAt = requireValidTimestamp(input.createdAt, "createdAt");
  const reason = optionalNonEmptyString(input.reason, "reason");

  return deepFreeze({
    blockId,
    blockerParticipantId,
    blockedParticipantId,
    createdAt,
    reason,
  });
}
