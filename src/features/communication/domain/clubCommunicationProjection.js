/**
 * Club channel projection helpers (COMMS-03).
 */

import { MESSAGE_STATUS } from "../constants/messageLifecycle.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import {
  compareClubChannelSummaries,
  createClubChannelSummaryContract,
} from "../contracts/clubChannelSummary.js";
import { createParticipantId } from "../contracts/identifiers.js";
import { timestampSortValue } from "../contracts/shared.js";
import { countUnreadDirectMessages } from "./directMessagingProjection.js";

/**
 * Reuse unread counting semantics from Direct Messaging (same message lifecycle).
 * @param {readonly object[]} messages
 * @param {object|null|undefined} readCursor
 * @param {string} viewerParticipantId
 * @returns {number}
 */
export function countUnreadClubMessages(
  messages,
  readCursor,
  viewerParticipantId
) {
  return countUnreadDirectMessages(messages, readCursor, viewerParticipantId);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function buildClubChannelSummary(input = {}) {
  const viewerParticipantId = createParticipantId(input.viewerParticipantId);
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
  const unreadCount = countUnreadClubMessages(
    messages,
    input.readCursor,
    viewerParticipantId
  );

  const participant = (Array.isArray(input.participants)
    ? input.participants
    : []
  ).find((p) => p.participantId === viewerParticipantId);

  const participantAccessState = participant
    ? String(participant.status)
    : input.accessAllowed === true
      ? "ELIGIBLE"
      : "DENIED";

  const pinnedMessageIds = Array.isArray(input.pinnedMessageIds)
    ? input.pinnedMessageIds
    : [];

  return createClubChannelSummaryContract({
    conversationId: input.conversation.conversationId,
    clubId: input.clubId ?? input.conversation.clubId,
    channelKind: input.channelKind,
    channelKey: input.channelKey,
    name: input.name ?? null,
    status: input.conversation.status,
    viewerParticipantId,
    latestMessageId: latest?.messageId ?? null,
    latestMessageBodyPreview: latest?.body
      ? String(latest.body).slice(0, 240)
      : null,
    latestActivityAt:
      latest?.createdAt ?? input.conversation.createdAt ?? null,
    unreadCount,
    hasUnread: unreadCount > 0,
    participantAccessState,
    pinnedMessageIds,
  });
}

/**
 * @param {readonly object[]} summaries
 * @returns {Readonly<object>[]}
 */
export function sortClubChannelSummaries(summaries) {
  const list = Array.isArray(summaries) ? [...summaries] : [];
  list.sort(compareClubChannelSummaries);
  return Object.freeze(list);
}

/**
 * @param {readonly object[]} participants
 * @param {string} conversationId
 * @returns {object[]}
 */
export function findActiveClubParticipants(participants, conversationId) {
  return (Array.isArray(participants) ? participants : []).filter(
    (p) =>
      p.conversationId === conversationId &&
      p.status === PARTICIPANT_STATUS.ACTIVE
  );
}

/**
 * Visible messages only — soft-deleted excluded from pin targets implicitly by caller.
 * @param {object|null|undefined} message
 * @returns {boolean}
 */
export function isPinnableClubMessage(message) {
  if (!message || typeof message !== "object") return false;
  return (
    message.status === MESSAGE_STATUS.VISIBLE ||
    message.status === MESSAGE_STATUS.EDITED
  );
}

export { compareClubChannelSummaries };
