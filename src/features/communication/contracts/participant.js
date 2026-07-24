/**
 * Conversation participant contract (COMMS-01).
 */

import {
  CONVERSATION_ROLE,
  isConversationRole,
} from "../constants/conversationRoles.js";
import {
  PARTICIPANT_STATUS,
  isParticipantStatus,
} from "../constants/participantLifecycle.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createConversationId,
  createParticipantId,
} from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} ConversationParticipantContract
 * @property {string} participantId
 * @property {string} conversationId
 * @property {string} role
 * @property {string} status
 * @property {string|number} joinedAt
 * @property {string|null} playerId
 * @property {string|number|null} mutedUntil
 */

/**
 * @param {object} input
 * @returns {Readonly<ConversationParticipantContract>}
 */
export function createConversationParticipantContract(input = {}) {
  const participantId = createParticipantId(input.participantId);
  const conversationId = createConversationId(input.conversationId);
  const role = input.role == null ? CONVERSATION_ROLE.MEMBER : input.role;
  if (!isConversationRole(role)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_PARTICIPANT_ROLE,
      `Unsupported conversation role: ${String(role)}`,
      { role, allowed: Object.values(CONVERSATION_ROLE) }
    );
  }
  const status =
    input.status == null ? PARTICIPANT_STATUS.ACTIVE : input.status;
  if (!isParticipantStatus(status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_PARTICIPANT_STATUS,
      `Unsupported participant status: ${String(status)}`,
      { status }
    );
  }
  const joinedAt = requireValidTimestamp(input.joinedAt, "joinedAt");
  const playerId = optionalNonEmptyString(input.playerId, "playerId");
  let mutedUntil = null;
  if (input.mutedUntil != null && input.mutedUntil !== "") {
    mutedUntil = requireValidTimestamp(input.mutedUntil, "mutedUntil");
  }

  return deepFreeze({
    participantId,
    conversationId,
    role: String(role),
    status: String(status),
    joinedAt,
    playerId,
    mutedUntil,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConversationParticipantContract(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof v.participantId === "string" &&
    typeof v.conversationId === "string" &&
    isConversationRole(v.role) &&
    isParticipantStatus(v.status)
  );
}
