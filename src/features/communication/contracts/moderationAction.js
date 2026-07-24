/**
 * Moderation action contract (COMMS-01).
 */

import {
  MODERATION_ACTION_TYPE,
  isModerationActionType,
} from "../constants/moderationActions.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createConversationId,
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
 * @typedef {Object} ModerationActionContract
 * @property {string} actionId
 * @property {string} type
 * @property {string} conversationId
 * @property {string} actorParticipantId
 * @property {string|null} targetParticipantId
 * @property {string|null} targetMessageId
 * @property {string|number} createdAt
 * @property {string|null} reason
 */

/**
 * @param {object} input
 * @returns {Readonly<ModerationActionContract>}
 */
export function createModerationActionContract(input = {}) {
  const actionId = requireOpaqueId(input.actionId, "actionId");
  if (!isModerationActionType(input.type)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MODERATION_ACTION,
      `Unsupported moderation action type: ${String(input.type)}`,
      { type: input.type, allowed: Object.values(MODERATION_ACTION_TYPE) }
    );
  }
  const conversationId = createConversationId(input.conversationId);
  const actorParticipantId = createParticipantId(input.actorParticipantId);
  const targetParticipantId = optionalNonEmptyString(
    input.targetParticipantId,
    "targetParticipantId"
  );
  const targetMessageId = optionalNonEmptyString(
    input.targetMessageId,
    "targetMessageId"
  );
  const createdAt = requireValidTimestamp(input.createdAt, "createdAt");
  const reason = optionalNonEmptyString(input.reason, "reason");

  const type = String(input.type);
  if (
    (type === MODERATION_ACTION_TYPE.MUTE_PARTICIPANT ||
      type === MODERATION_ACTION_TYPE.REMOVE_PARTICIPANT ||
      type === MODERATION_ACTION_TYPE.RESTRICT_PARTICIPANT ||
      type === MODERATION_ACTION_TYPE.BAN_PARTICIPANT ||
      type === MODERATION_ACTION_TYPE.RESTORE_PARTICIPANT) &&
    !targetParticipantId
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MODERATION_ACTION,
      `${type} requires targetParticipantId`,
      { type, field: "targetParticipantId" }
    );
  }
  if (
    (type === MODERATION_ACTION_TYPE.REMOVE_MESSAGE ||
      type === MODERATION_ACTION_TYPE.HIDE_MESSAGE) &&
    !targetMessageId
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MODERATION_ACTION,
      `${type} requires targetMessageId`,
      { type, field: "targetMessageId" }
    );
  }

  return deepFreeze({
    actionId,
    type,
    conversationId,
    actorParticipantId,
    targetParticipantId,
    targetMessageId,
    createdAt,
    reason,
  });
}
