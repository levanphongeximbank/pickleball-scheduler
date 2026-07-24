/**
 * Conversation contract factory (COMMS-01).
 */

import {
  CONVERSATION_STATUS,
  isConversationStatus,
} from "../constants/conversationStatus.js";
import {
  CONVERSATION_TYPE,
  isConversationType,
} from "../constants/conversationTypes.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createConversationId } from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} ConversationContract
 * @property {string} conversationId
 * @property {string} type
 * @property {string} status
 * @property {string|null} tenantId
 * @property {string|null} clubId
 * @property {string|null} contextRef
 * @property {string|number} createdAt
 * @property {string|null} createdByParticipantId
 */

/**
 * @param {object} input
 * @returns {Readonly<ConversationContract>}
 */
export function createConversationContract(input = {}) {
  const conversationId = createConversationId(input.conversationId);
  if (!isConversationType(input.type)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_TYPE,
      `Unsupported conversation type: ${String(input.type)}`,
      { type: input.type, allowed: Object.values(CONVERSATION_TYPE) }
    );
  }
  const status = input.status == null ? CONVERSATION_STATUS.ACTIVE : input.status;
  if (!isConversationStatus(status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_STATUS,
      `Unsupported conversation status: ${String(status)}`,
      { status }
    );
  }

  const tenantId = optionalNonEmptyString(input.tenantId, "tenantId");
  const clubId = optionalNonEmptyString(input.clubId, "clubId");
  const contextRef = optionalNonEmptyString(input.contextRef, "contextRef");
  const createdByParticipantId = optionalNonEmptyString(
    input.createdByParticipantId,
    "createdByParticipantId"
  );
  const createdAt = requireValidTimestamp(input.createdAt, "createdAt");

  if (input.type === CONVERSATION_TYPE.CLUB && !clubId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "CLUB conversation requires clubId",
      { type: input.type, field: "clubId" }
    );
  }

  if (input.type === CONVERSATION_TYPE.COMMUNITY && !tenantId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "COMMUNITY conversation requires tenantId",
      { type: input.type, field: "tenantId" }
    );
  }

  return deepFreeze({
    conversationId,
    type: String(input.type),
    status: String(status),
    tenantId,
    clubId,
    contextRef,
    createdAt,
    createdByParticipantId,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConversationContract(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof v.conversationId === "string" &&
    isConversationType(v.type) &&
    isConversationStatus(v.status)
  );
}
