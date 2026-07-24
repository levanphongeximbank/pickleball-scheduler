/**
 * Community pinned message contract (COMMS-04).
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createConversationId,
  createMessageId,
  createParticipantId,
} from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} CommunityPinnedMessageContract
 * @property {string} conversationId
 * @property {string} messageId
 * @property {string} pinnedByParticipantId
 * @property {string|number} pinnedAt
 */

/**
 * @param {object} input
 * @returns {Readonly<CommunityPinnedMessageContract>}
 */
export function createCommunityPinnedMessageContract(input = {}) {
  const conversationId = createConversationId(input.conversationId);
  const messageId = createMessageId(input.messageId);
  const pinnedByParticipantId = createParticipantId(
    input.pinnedByParticipantId
  );
  const pinnedAt = requireValidTimestamp(input.pinnedAt, "pinnedAt");

  if (!conversationId || !messageId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Pinned message requires conversationId and messageId"
    );
  }

  return deepFreeze({
    conversationId,
    messageId,
    pinnedByParticipantId,
    pinnedAt,
  });
}
