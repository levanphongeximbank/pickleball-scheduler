/**
 * Read receipt / read cursor contract (COMMS-01).
 * Cursor advances by lastReadAt (monotonic); optional lastReadMessageId.
 */

import {
  createConversationId,
  createParticipantId,
  requireOpaqueId,
} from "./identifiers.js";
import {
  deepFreeze,
  optionalNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} ReadCursorContract
 * @property {string} conversationId
 * @property {string} participantId
 * @property {string|number} lastReadAt
 * @property {string|null} lastReadMessageId
 */

/**
 * @param {object} input
 * @returns {Readonly<ReadCursorContract>}
 */
export function createReadCursorContract(input = {}) {
  const conversationId = createConversationId(input.conversationId);
  const participantId = createParticipantId(input.participantId);
  const lastReadAt = requireValidTimestamp(input.lastReadAt, "lastReadAt");
  const lastReadMessageId = optionalNonEmptyString(
    input.lastReadMessageId,
    "lastReadMessageId"
  );
  if (lastReadMessageId) {
    requireOpaqueId(lastReadMessageId, "lastReadMessageId");
  }

  return deepFreeze({
    conversationId,
    participantId,
    lastReadAt,
    lastReadMessageId,
  });
}
