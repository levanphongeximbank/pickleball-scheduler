/**
 * Message + reply reference contracts (COMMS-01).
 */

import {
  MESSAGE_STATUS,
  isMessageStatus,
} from "../constants/messageLifecycle.js";
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
  optionalNonEmptyString,
  requireNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} ReplyReferenceContract
 * @property {string} replyToMessageId
 * @property {string} conversationId
 */

/**
 * @typedef {Object} MessageContract
 * @property {string} messageId
 * @property {string} conversationId
 * @property {string} senderParticipantId
 * @property {string} body
 * @property {string} status
 * @property {string|number} createdAt
 * @property {string|number|null} updatedAt
 * @property {string|null} replyToMessageId
 * @property {readonly object[]} attachmentRefs
 */

/**
 * @param {object} input
 * @returns {Readonly<ReplyReferenceContract>}
 */
export function createReplyReferenceContract(input = {}) {
  return deepFreeze({
    replyToMessageId: createMessageId(input.replyToMessageId),
    conversationId: createConversationId(input.conversationId),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<MessageContract>}
 */
export function createMessageContract(input = {}) {
  const messageId = createMessageId(input.messageId);
  const conversationId = createConversationId(input.conversationId);
  const senderParticipantId = createParticipantId(input.senderParticipantId);
  const body = requireNonEmptyString(input.body, "body");
  const status = input.status == null ? MESSAGE_STATUS.VISIBLE : input.status;
  if (!isMessageStatus(status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MESSAGE_STATUS,
      `Unsupported message status: ${String(status)}`,
      { status }
    );
  }
  const createdAt = requireValidTimestamp(input.createdAt, "createdAt");
  let updatedAt = null;
  if (input.updatedAt != null && input.updatedAt !== "") {
    updatedAt = requireValidTimestamp(input.updatedAt, "updatedAt");
  }
  const replyToMessageId = optionalNonEmptyString(
    input.replyToMessageId,
    "replyToMessageId"
  );
  const attachmentRefs = Array.isArray(input.attachmentRefs)
    ? input.attachmentRefs.map((ref, index) => {
        if (!ref || typeof ref !== "object") {
          failContract(
            COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_ATTACHMENT_REF,
            `attachmentRefs[${index}] must be an object`,
            { index }
          );
        }
        return deepFreeze({ .../** @type {object} */ (ref) });
      })
    : [];

  if (replyToMessageId) {
    requireOpaqueId(replyToMessageId, "replyToMessageId");
  }

  return deepFreeze({
    messageId,
    conversationId,
    senderParticipantId,
    body,
    status: String(status),
    createdAt,
    updatedAt,
    replyToMessageId,
    attachmentRefs,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMessageContract(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof v.messageId === "string" &&
    typeof v.conversationId === "string" &&
    typeof v.senderParticipantId === "string" &&
    typeof v.body === "string" &&
    isMessageStatus(v.status)
  );
}
