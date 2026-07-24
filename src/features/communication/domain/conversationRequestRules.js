/**
 * Conversation request lifecycle rules (COMMS-02).
 */

import {
  CONVERSATION_REQUEST_ALLOWED_TRANSITIONS,
  CONVERSATION_REQUEST_STATUS,
  CONVERSATION_REQUEST_TERMINAL_STATUSES,
} from "../constants/conversationRequestStatus.js";
import { createConversationRequestContract } from "../contracts/conversationRequest.js";
import { createParticipantId } from "../contracts/identifiers.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { failContract } from "../contracts/shared.js";

/**
 * @param {object} request
 * @returns {boolean}
 */
export function isConversationRequestTerminal(request) {
  return CONVERSATION_REQUEST_TERMINAL_STATUSES.includes(request?.status);
}

/**
 * @param {object} request
 * @param {string} nextStatus
 * @param {object} [extras]
 * @returns {Readonly<object>}
 */
export function transitionConversationRequestStatus(
  request,
  nextStatus,
  extras = {}
) {
  if (!request || typeof request !== "object") {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "conversation request is required for status transition"
    );
  }
  const from = request.status;
  const allowed = CONVERSATION_REQUEST_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(nextStatus)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REQUEST_TRANSITION,
      `Invalid conversation request transition ${from} → ${nextStatus}`,
      {
        requestId: request.requestId,
        from,
        to: nextStatus,
      }
    );
  }
  return createConversationRequestContract({
    ...request,
    ...extras,
    status: nextStatus,
  });
}

/**
 * Only recipient may accept or decline a PENDING request.
 * @param {object} request
 * @param {string} actorParticipantId
 * @param {"ACCEPTED"|"DECLINED"} nextStatus
 * @param {string|number} updatedAt
 */
export function acceptOrDeclineConversationRequest(
  request,
  actorParticipantId,
  nextStatus,
  updatedAt
) {
  const actor = createParticipantId(actorParticipantId);
  if (request.status !== CONVERSATION_REQUEST_STATUS.PENDING) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REQUEST_TRANSITION,
      `Cannot accept/decline request in status ${request.status}`,
      { requestId: request.requestId, status: request.status }
    );
  }
  if (actor !== request.recipientParticipantId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_REQUEST_ACTION,
      "Only the recipient may accept or decline a conversation request",
      {
        requestId: request.requestId,
        actorParticipantId: actor,
        recipientParticipantId: request.recipientParticipantId,
      }
    );
  }
  if (
    nextStatus !== CONVERSATION_REQUEST_STATUS.ACCEPTED &&
    nextStatus !== CONVERSATION_REQUEST_STATUS.DECLINED
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REQUEST_TRANSITION,
      `acceptOrDecline expects ACCEPTED or DECLINED, got ${String(nextStatus)}`,
      { nextStatus }
    );
  }
  return transitionConversationRequestStatus(request, nextStatus, {
    updatedAt,
  });
}

/**
 * Only requester may cancel a PENDING request.
 * @param {object} request
 * @param {string} actorParticipantId
 * @param {string|number} updatedAt
 */
export function cancelConversationRequest(request, actorParticipantId, updatedAt) {
  const actor = createParticipantId(actorParticipantId);
  if (request.status !== CONVERSATION_REQUEST_STATUS.PENDING) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REQUEST_TRANSITION,
      `Cannot cancel request in status ${request.status}`,
      { requestId: request.requestId, status: request.status }
    );
  }
  if (actor !== request.requesterParticipantId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_REQUEST_ACTION,
      "Only the requester may cancel a conversation request",
      {
        requestId: request.requestId,
        actorParticipantId: actor,
        requesterParticipantId: request.requesterParticipantId,
      }
    );
  }
  return transitionConversationRequestStatus(
    request,
    CONVERSATION_REQUEST_STATUS.CANCELLED,
    { updatedAt }
  );
}
