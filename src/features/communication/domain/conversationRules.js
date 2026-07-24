/**
 * Conversation + participant domain rules (pure, deterministic).
 */

import {
  CONVERSATION_ALLOWED_TRANSITIONS,
  CONVERSATION_STATUS,
} from "../constants/conversationStatus.js";
import { CONVERSATION_TYPE } from "../constants/conversationTypes.js";
import { CONVERSATION_ROLE } from "../constants/conversationRoles.js";
import {
  PARTICIPANT_ALLOWED_TRANSITIONS,
  PARTICIPANT_STATUS,
} from "../constants/participantLifecycle.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { createConversationContract } from "../contracts/conversation.js";
import { createConversationParticipantContract } from "../contracts/participant.js";
import { createParticipantId } from "../contracts/identifiers.js";
import { deepFreeze, failContract } from "../contracts/shared.js";
import { isConversationType } from "../constants/conversationTypes.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function assertConversationType(input) {
  const type = input?.type ?? input;
  if (!isConversationType(type)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_TYPE,
      `Unsupported conversation type: ${String(type)}`,
      { type, allowed: Object.values(CONVERSATION_TYPE) }
    );
  }
  return String(type);
}

/**
 * Create a valid conversation aggregate seed (conversation + participants).
 * DIRECT requires exactly two distinct participants when seed participants are supplied.
 *
 * @param {object} input
 * @returns {Readonly<{ conversation: object, participants: readonly object[] }>}
 */
export function createValidConversation(input = {}) {
  const conversation = createConversationContract(input);
  const rawParticipants = Array.isArray(input.participants)
    ? input.participants
    : [];

  if (
    conversation.type === CONVERSATION_TYPE.DIRECT &&
    rawParticipants.length > 0 &&
    rawParticipants.length !== 2
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "DIRECT conversation requires exactly two participants when seeded",
      {
        type: conversation.type,
        participantCount: rawParticipants.length,
      }
    );
  }

  /** @type {object[]} */
  const participants = [];
  const seen = new Set();
  for (const raw of rawParticipants) {
    const participant = createConversationParticipantContract({
      ...raw,
      conversationId: conversation.conversationId,
      joinedAt: raw.joinedAt ?? conversation.createdAt,
    });
    if (seen.has(participant.participantId)) {
      failContract(
        COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT,
        `Duplicate participant in conversation seed: ${participant.participantId}`,
        {
          conversationId: conversation.conversationId,
          participantId: participant.participantId,
        }
      );
    }
    seen.add(participant.participantId);
    participants.push(participant);
  }

  if (
    conversation.type === CONVERSATION_TYPE.DIRECT &&
    participants.length === 2
  ) {
    // already validated distinct via seen
  }

  return deepFreeze({ conversation, participants });
}

/**
 * @param {object} conversation
 * @param {string} nextStatus
 * @returns {Readonly<object>}
 */
export function transitionConversationStatus(conversation, nextStatus) {
  if (!conversation || typeof conversation !== "object") {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "conversation is required for status transition"
    );
  }
  const from = conversation.status;
  const allowed = CONVERSATION_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(nextStatus)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_TRANSITION,
      `Invalid conversation transition ${from} → ${nextStatus}`,
      {
        conversationId: conversation.conversationId,
        from,
        to: nextStatus,
      }
    );
  }
  return createConversationContract({
    ...conversation,
    status: nextStatus,
  });
}

/**
 * @param {readonly object[]} participants
 * @param {object} candidateInput
 * @returns {Readonly<object>}
 */
export function addParticipant(participants, candidateInput) {
  const list = Array.isArray(participants) ? participants : [];
  const candidate = createConversationParticipantContract(candidateInput);
  const duplicate = list.find(
    (p) =>
      p.participantId === candidate.participantId &&
      p.conversationId === candidate.conversationId &&
      p.status !== PARTICIPANT_STATUS.REMOVED
  );
  if (duplicate) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT,
      `Participant already present: ${candidate.participantId}`,
      {
        conversationId: candidate.conversationId,
        participantId: candidate.participantId,
      }
    );
  }
  return candidate;
}

/**
 * @param {object} participant
 * @param {string} nextRole
 * @returns {Readonly<object>}
 */
export function updateParticipantRole(participant, nextRole) {
  return createConversationParticipantContract({
    ...participant,
    role: nextRole,
  });
}

/**
 * @param {object} participant
 * @param {string} nextStatus
 * @param {object} [extras]
 * @returns {Readonly<object>}
 */
export function transitionParticipantStatus(participant, nextStatus, extras = {}) {
  if (!participant || typeof participant !== "object") {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "participant is required for status transition"
    );
  }
  const from = participant.status;
  const allowed = PARTICIPANT_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(nextStatus)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_PARTICIPANT_TRANSITION,
      `Invalid participant transition ${from} → ${nextStatus}`,
      {
        participantId: participant.participantId,
        conversationId: participant.conversationId,
        from,
        to: nextStatus,
      }
    );
  }
  return createConversationParticipantContract({
    ...participant,
    ...extras,
    status: nextStatus,
  });
}

/**
 * Suspend (temporary) or remove (terminal) a participant via valid lifecycle.
 * @param {object} participant
 * @param {"SUSPENDED"|"REMOVED"} action
 * @param {object} [extras]
 */
export function suspendOrRemoveParticipant(participant, action, extras = {}) {
  if (
    action !== PARTICIPANT_STATUS.SUSPENDED &&
    action !== PARTICIPANT_STATUS.REMOVED
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_PARTICIPANT_STATUS,
      `suspendOrRemoveParticipant expects SUSPENDED or REMOVED, got ${String(action)}`,
      { action }
    );
  }
  return transitionParticipantStatus(participant, action, extras);
}

/**
 * Foundation send gate: conversation ACTIVE + participant ACTIVE + same conversation.
 * Deep Direct/Club/Community policy is deferred to later phases.
 *
 * @param {object} conversation
 * @param {object} participant
 * @returns {true}
 */
export function assertCanSendMessage(conversation, participant) {
  if (!conversation || typeof conversation !== "object") {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "conversation is required to authorize send"
    );
  }
  if (!participant || typeof participant !== "object") {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
      "participant is required to authorize send"
    );
  }
  if (participant.conversationId !== conversation.conversationId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
      "Sender participant does not belong to conversation",
      {
        conversationId: conversation.conversationId,
        participantConversationId: participant.conversationId,
        participantId: participant.participantId,
      }
    );
  }
  if (conversation.status !== CONVERSATION_STATUS.ACTIVE) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
      `Cannot send message when conversation status is ${conversation.status}`,
      {
        conversationId: conversation.conversationId,
        status: conversation.status,
      }
    );
  }
  if (participant.status !== PARTICIPANT_STATUS.ACTIVE) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
      `Cannot send message when participant status is ${participant.status}`,
      {
        participantId: participant.participantId,
        status: participant.status,
      }
    );
  }
  createParticipantId(participant.participantId);
  if (
    ![
      CONVERSATION_ROLE.MEMBER,
      CONVERSATION_ROLE.MODERATOR,
      CONVERSATION_ROLE.OWNER,
    ].includes(participant.role)
  ) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
      `Participant role cannot send: ${participant.role}`,
      { role: participant.role }
    );
  }
  return true;
}

/**
 * @param {readonly object[]} participants
 * @param {string} participantId
 * @param {string} conversationId
 * @returns {object}
 */
export function findActiveParticipant(participants, participantId, conversationId) {
  const id = createParticipantId(participantId);
  const found = (Array.isArray(participants) ? participants : []).find(
    (p) =>
      p.participantId === id &&
      p.conversationId === conversationId &&
      p.status !== PARTICIPANT_STATUS.REMOVED
  );
  if (!found) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_NOT_FOUND,
      `Participant not found in conversation: ${id}`,
      { participantId: id, conversationId }
    );
  }
  return found;
}
