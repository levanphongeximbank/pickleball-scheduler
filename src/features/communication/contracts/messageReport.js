/**
 * Message report contract (COMMS-01).
 */

import {
  createConversationId,
  createMessageId,
  createParticipantId,
  requireOpaqueId,
} from "./identifiers.js";
import {
  deepFreeze,
  optionalNonEmptyString,
  requireNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} MessageReportContract
 * @property {string} reportId
 * @property {string} messageId
 * @property {string} conversationId
 * @property {string} reporterParticipantId
 * @property {string} reason
 * @property {string|number} createdAt
 * @property {string|null} details
 */

/**
 * @param {object} input
 * @returns {Readonly<MessageReportContract>}
 */
export function createMessageReportContract(input = {}) {
  return deepFreeze({
    reportId: requireOpaqueId(input.reportId, "reportId"),
    messageId: createMessageId(input.messageId),
    conversationId: createConversationId(input.conversationId),
    reporterParticipantId: createParticipantId(input.reporterParticipantId),
    reason: requireNonEmptyString(input.reason, "reason"),
    createdAt: requireValidTimestamp(input.createdAt, "createdAt"),
    details: optionalNonEmptyString(input.details, "details"),
  });
}
