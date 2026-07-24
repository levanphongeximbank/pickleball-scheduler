/**
 * Direct conversation request contract (COMMS-02).
 */

import {
  CONVERSATION_REQUEST_STATUS,
  isConversationRequestStatus,
} from "../constants/conversationRequestStatus.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createDirectPairContract } from "./directPair.js";
import { createParticipantId, requireOpaqueId } from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} ConversationRequestContract
 * @property {string} requestId
 * @property {string} pairKey
 * @property {string} requesterParticipantId
 * @property {string} recipientParticipantId
 * @property {string} status
 * @property {string|number} createdAt
 * @property {string|number|null} updatedAt
 * @property {string|null} message
 */

/**
 * @param {object} input
 * @returns {Readonly<ConversationRequestContract>}
 */
export function createConversationRequestContract(input = {}) {
  const requestId = requireOpaqueId(input.requestId, "requestId");
  const requesterParticipantId = createParticipantId(
    input.requesterParticipantId
  );
  const recipientParticipantId = createParticipantId(
    input.recipientParticipantId
  );

  if (requesterParticipantId === recipientParticipantId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED,
      "Conversation request requires distinct requester and recipient",
      { requesterParticipantId, recipientParticipantId }
    );
  }

  const pair = createDirectPairContract(
    requesterParticipantId,
    recipientParticipantId
  );
  const pairKey =
    optionalNonEmptyString(input.pairKey, "pairKey") ?? pair.pairKey;
  if (pairKey !== pair.pairKey) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.DIRECT_PAIR_INVALID,
      "pairKey does not match requester/recipient canonical pair",
      { pairKey, expectedPairKey: pair.pairKey }
    );
  }

  const status =
    input.status == null ? CONVERSATION_REQUEST_STATUS.PENDING : input.status;
  if (!isConversationRequestStatus(status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported conversation request status: ${String(status)}`,
      { status }
    );
  }

  const createdAt = requireValidTimestamp(input.createdAt, "createdAt");
  let updatedAt = null;
  if (input.updatedAt != null && input.updatedAt !== "") {
    updatedAt = requireValidTimestamp(input.updatedAt, "updatedAt");
  }
  const message = optionalNonEmptyString(input.message, "message");

  return deepFreeze({
    requestId,
    pairKey,
    requesterParticipantId,
    recipientParticipantId,
    status: String(status),
    createdAt,
    updatedAt,
    message,
  });
}
