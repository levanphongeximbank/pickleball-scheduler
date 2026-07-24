/**
 * Community channel projection helpers (COMMS-04).
 */

import { MESSAGE_STATUS } from "../constants/messageLifecycle.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import {
  compareCommunityChannelSummaries,
  createCommunityChannelSummaryContract,
} from "../contracts/communityChannelSummary.js";
import { createParticipantId } from "../contracts/identifiers.js";
import { timestampSortValue } from "../contracts/shared.js";
import { countUnreadDirectMessages } from "./directMessagingProjection.js";

/**
 * Reuse unread counting semantics from Direct Messaging.
 * @param {readonly object[]} messages
 * @param {object|null|undefined} readCursor
 * @param {string} viewerParticipantId
 * @returns {number}
 */
export function countUnreadCommunityMessages(
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
export function buildCommunityChannelSummary(input = {}) {
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
  const unreadCount = countUnreadCommunityMessages(
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
    : input.accessDecision === "ALLOW"
      ? "ELIGIBLE"
      : String(input.accessDecision || "DENIED");

  const pinnedMessageIds = Array.isArray(input.pinnedMessageIds)
    ? input.pinnedMessageIds
    : [];

  return createCommunityChannelSummaryContract({
    conversationId: input.conversation.conversationId,
    tenantId: input.tenantId ?? input.conversation.tenantId,
    channelKind: input.channelKind,
    visibility: input.visibility,
    channelKey: input.channelKey,
    name: input.name ?? null,
    status: input.conversation.status,
    lifecycleStatus: input.lifecycleStatus ?? "ACTIVE",
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
    accessDecision: input.accessDecision ?? "DENY",
    slowModeIntervalSeconds: input.slowModeIntervalSeconds ?? 0,
    pinnedMessageIds,
  });
}

/**
 * @param {readonly object[]} summaries
 * @returns {Readonly<object>[]}
 */
export function sortCommunityChannelSummaries(summaries) {
  const list = Array.isArray(summaries) ? [...summaries] : [];
  list.sort(compareCommunityChannelSummaries);
  return Object.freeze(list);
}

/**
 * @param {readonly object[]} participants
 * @param {string} conversationId
 * @returns {object[]}
 */
export function findActiveCommunityParticipants(participants, conversationId) {
  return (Array.isArray(participants) ? participants : []).filter(
    (p) =>
      p.conversationId === conversationId &&
      p.status === PARTICIPANT_STATUS.ACTIVE
  );
}

/**
 * @param {object|null|undefined} message
 * @returns {boolean}
 */
export function isPinnableCommunityMessage(message) {
  if (!message || typeof message !== "object") return false;
  return (
    message.status === MESSAGE_STATUS.VISIBLE ||
    message.status === MESSAGE_STATUS.EDITED
  );
}

export { compareCommunityChannelSummaries };
