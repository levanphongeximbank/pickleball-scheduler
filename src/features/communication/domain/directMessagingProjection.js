/**
 * Direct conversation inbox projection helpers (COMMS-02).
 */

import { MESSAGE_STATUS } from "../constants/messageLifecycle.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import {
  compareDirectConversationSummaries,
  createDirectConversationSummaryContract,
} from "../contracts/directConversationSummary.js";
import { getDirectPairCounterpart } from "../contracts/directPair.js";
import { createParticipantId } from "../contracts/identifiers.js";
import { timestampSortValue } from "../contracts/shared.js";

/**
 * Count unread visible/edited messages after the viewer's read cursor.
 *
 * @param {readonly object[]} messages
 * @param {object|null|undefined} readCursor
 * @param {string} viewerParticipantId
 * @returns {number}
 */
export function countUnreadDirectMessages(
  messages,
  readCursor,
  viewerParticipantId
) {
  const viewer = createParticipantId(viewerParticipantId);
  const list = Array.isArray(messages) ? messages : [];
  const cursorMs =
    readCursor && readCursor.lastReadAt != null
      ? timestampSortValue(readCursor.lastReadAt)
      : -Infinity;

  let count = 0;
  for (const message of list) {
    if (!message || typeof message !== "object") continue;
    if (
      message.status !== MESSAGE_STATUS.VISIBLE &&
      message.status !== MESSAGE_STATUS.EDITED
    ) {
      continue;
    }
    if (message.senderParticipantId === viewer) continue;
    if (timestampSortValue(message.createdAt) > cursorMs) {
      count += 1;
    }
  }
  return count;
}

/**
 * Build one deterministic direct conversation summary for a viewer.
 *
 * @param {object} input
 * @param {object} input.conversation
 * @param {object} input.pair
 * @param {string} input.viewerParticipantId
 * @param {readonly object[]} [input.messages]
 * @param {object|null} [input.readCursor]
 * @returns {Readonly<object>}
 */
export function buildDirectConversationSummary(input = {}) {
  const viewerParticipantId = createParticipantId(input.viewerParticipantId);
  const counterpartParticipantId = getDirectPairCounterpart(
    input.pair,
    viewerParticipantId
  );
  const messages = Array.isArray(input.messages) ? [...input.messages] : [];
  messages.sort((a, b) => {
    const diff =
      timestampSortValue(a.createdAt) - timestampSortValue(b.createdAt);
    if (diff !== 0) return diff;
    if (a.messageId < b.messageId) return -1;
    if (a.messageId > b.messageId) return 1;
    return 0;
  });

  const latest = messages.length > 0 ? messages[messages.length - 1] : null;
  const unreadCount = countUnreadDirectMessages(
    messages,
    input.readCursor,
    viewerParticipantId
  );

  return createDirectConversationSummaryContract({
    conversationId: input.conversation.conversationId,
    pairKey: input.pair.pairKey,
    viewerParticipantId,
    counterpartParticipantId,
    status: input.conversation.status,
    latestMessageId: latest?.messageId ?? null,
    latestMessageBodyPreview: latest?.body
      ? String(latest.body).slice(0, 240)
      : null,
    latestActivityAt:
      latest?.createdAt ??
      input.conversation.createdAt ??
      null,
    unreadCount,
    hasUnread: unreadCount > 0,
  });
}

/**
 * @param {readonly object[]} summaries
 * @returns {Readonly<object>[]}
 */
export function sortDirectConversationSummaries(summaries) {
  const list = Array.isArray(summaries) ? [...summaries] : [];
  list.sort(compareDirectConversationSummaries);
  return Object.freeze(list);
}

/**
 * Ensure both DIRECT participants are ACTIVE before send.
 * @param {readonly object[]} participants
 * @param {string} conversationId
 * @returns {{ sender: object, recipient: object }|null} — caller supplies sender id separately
 */
export function findActiveDirectParticipants(participants, conversationId) {
  const active = (Array.isArray(participants) ? participants : []).filter(
    (p) =>
      p.conversationId === conversationId &&
      p.status === PARTICIPANT_STATUS.ACTIVE
  );
  return active;
}
