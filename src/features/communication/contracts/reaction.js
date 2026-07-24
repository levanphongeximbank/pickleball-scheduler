/**
 * Reaction contract (COMMS-01).
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createConversationId,
  createMessageId,
  createParticipantId,
  requireOpaqueId,
} from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  requireNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/** Soft upper bound to keep reactions lightweight. */
export const MAX_REACTION_EMOJI_LENGTH = 32;

/**
 * @typedef {Object} ReactionContract
 * @property {string} reactionId
 * @property {string} messageId
 * @property {string} conversationId
 * @property {string} participantId
 * @property {string} emoji
 * @property {string|number} createdAt
 */

/**
 * @param {object} input
 * @returns {Readonly<ReactionContract>}
 */
export function createReactionContract(input = {}) {
  const reactionId = requireOpaqueId(input.reactionId, "reactionId");
  const messageId = createMessageId(input.messageId);
  const conversationId = createConversationId(input.conversationId);
  const participantId = createParticipantId(input.participantId);
  const emoji = requireNonEmptyString(input.emoji, "emoji");
  if (emoji.length > MAX_REACTION_EMOJI_LENGTH) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REACTION,
      `Reaction emoji exceeds max length ${MAX_REACTION_EMOJI_LENGTH}`,
      { field: "emoji", length: emoji.length }
    );
  }
  const createdAt = requireValidTimestamp(input.createdAt, "createdAt");

  return deepFreeze({
    reactionId,
    messageId,
    conversationId,
    participantId,
    emoji,
    createdAt,
  });
}
