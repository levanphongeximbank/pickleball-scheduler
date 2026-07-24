/**
 * Message domain rules (pure, deterministic).
 */

import {
  MESSAGE_ALLOWED_TRANSITIONS,
  MESSAGE_STATUS,
} from "../constants/messageLifecycle.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createMessageContract } from "../contracts/message.js";
import { createMessageId } from "../contracts/identifiers.js";
import { failContract } from "../contracts/shared.js";
import { assertCanSendMessage } from "./conversationRules.js";

/**
 * @param {object} conversation
 * @param {object} senderParticipant
 * @param {object} messageInput
 * @returns {Readonly<object>}
 */
export function createMessageForConversation(
  conversation,
  senderParticipant,
  messageInput = {}
) {
  assertCanSendMessage(conversation, senderParticipant);
  return createMessageContract({
    ...messageInput,
    conversationId: conversation.conversationId,
    senderParticipantId: senderParticipant.participantId,
    status: messageInput.status ?? MESSAGE_STATUS.VISIBLE,
  });
}

/**
 * Reply target must belong to the same conversation.
 *
 * @param {object} messageInputOrMessage
 * @param {object|null|undefined} replyTargetMessage
 * @param {string} conversationId
 * @returns {true}
 */
export function assertReplyTargetInConversation(
  messageInputOrMessage,
  replyTargetMessage,
  conversationId
) {
  const replyToMessageId =
    messageInputOrMessage?.replyToMessageId ?? null;
  if (!replyToMessageId) {
    return true;
  }
  const expectedId = createMessageId(replyToMessageId);
  if (!replyTargetMessage) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.REPLY_TARGET_NOT_FOUND,
      `Reply target message not found: ${expectedId}`,
      { replyToMessageId: expectedId, conversationId }
    );
  }
  if (replyTargetMessage.conversationId !== conversationId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CROSS_CONVERSATION_REPLY,
      "Reply target belongs to a different conversation",
      {
        conversationId,
        replyToMessageId: expectedId,
        replyTargetConversationId: replyTargetMessage.conversationId,
      }
    );
  }
  if (replyTargetMessage.messageId !== expectedId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.REPLY_TARGET_NOT_FOUND,
      `Reply target message id mismatch: ${expectedId}`,
      {
        replyToMessageId: expectedId,
        actualMessageId: replyTargetMessage.messageId,
      }
    );
  }
  return true;
}

/**
 * @param {object} message
 * @param {string} nextStatus
 * @param {object} [extras]
 * @returns {Readonly<object>}
 */
export function transitionMessageStatus(message, nextStatus, extras = {}) {
  if (!message || typeof message !== "object") {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "message is required for status transition"
    );
  }
  const from = message.status;
  const allowed = MESSAGE_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(nextStatus)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MESSAGE_TRANSITION,
      `Invalid message transition ${from} → ${nextStatus}`,
      {
        messageId: message.messageId,
        from,
        to: nextStatus,
      }
    );
  }
  return createMessageContract({
    ...message,
    ...extras,
    status: nextStatus,
    body:
      nextStatus === MESSAGE_STATUS.DELETED
        ? extras.body ?? message.body ?? "[deleted]"
        : extras.body ?? message.body,
  });
}
