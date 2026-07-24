/**
 * Read cursor monotonic advance rules (pure, deterministic).
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createReadCursorContract } from "../contracts/readCursor.js";
import { failContract, timestampSortValue } from "../contracts/shared.js";

/**
 * Advance read cursor only forward in time (and same conversation/participant).
 *
 * @param {object|null|undefined} currentCursor
 * @param {object} nextCursorInput
 * @returns {Readonly<object>}
 */
export function advanceReadCursor(currentCursor, nextCursorInput) {
  const next = createReadCursorContract(nextCursorInput);

  if (!currentCursor) {
    return next;
  }

  if (
    currentCursor.conversationId !== next.conversationId ||
    currentCursor.participantId !== next.participantId
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Read cursor advance requires same conversationId and participantId",
      {
        currentConversationId: currentCursor.conversationId,
        nextConversationId: next.conversationId,
        currentParticipantId: currentCursor.participantId,
        nextParticipantId: next.participantId,
      }
    );
  }

  const currentMs = timestampSortValue(currentCursor.lastReadAt);
  const nextMs = timestampSortValue(next.lastReadAt);
  if (nextMs < currentMs) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION,
      "Read cursor must only advance forward",
      {
        conversationId: next.conversationId,
        participantId: next.participantId,
        currentLastReadAt: currentCursor.lastReadAt,
        nextLastReadAt: next.lastReadAt,
      }
    );
  }

  return next;
}
