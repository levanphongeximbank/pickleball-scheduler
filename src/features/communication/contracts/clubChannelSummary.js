/**
 * Deterministic club channel summary projection (COMMS-03).
 * Identifiers + channel metadata only — no club avatar / branding / full membership profile.
 */

import { isConversationStatus } from "../constants/conversationStatus.js";
import { isClubChannelKind } from "../constants/clubChannelKinds.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createConversationId,
  createMessageId,
  createParticipantId,
  requireOpaqueId,
} from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireValidTimestamp,
  timestampSortValue,
} from "./shared.js";

/**
 * @typedef {Object} ClubChannelSummaryContract
 * @property {string} conversationId
 * @property {string} clubId
 * @property {string} channelKind
 * @property {string} channelKey
 * @property {string|null} name
 * @property {string} status
 * @property {string} viewerParticipantId
 * @property {string|null} latestMessageId
 * @property {string|null} latestMessageBodyPreview
 * @property {string|number|null} latestActivityAt
 * @property {number} unreadCount
 * @property {boolean} hasUnread
 * @property {string} participantAccessState
 * @property {readonly string[]} pinnedMessageIds
 */

/**
 * @param {object} input
 * @returns {Readonly<ClubChannelSummaryContract>}
 */
export function createClubChannelSummaryContract(input = {}) {
  const conversationId = createConversationId(input.conversationId);
  const clubId = requireOpaqueId(input.clubId, "clubId");
  if (!isClubChannelKind(input.channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND,
      `Unsupported club channel kind in summary: ${String(input.channelKind)}`,
      { channelKind: input.channelKind }
    );
  }
  const channelKey = requireOpaqueId(input.channelKey, "channelKey");
  const name = optionalNonEmptyString(input.name, "name");
  if (!isConversationStatus(input.status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_STATUS,
      `Unsupported conversation status in club summary: ${String(input.status)}`,
      { status: input.status }
    );
  }
  const viewerParticipantId = createParticipantId(input.viewerParticipantId);

  const latestMessageId = optionalNonEmptyString(
    input.latestMessageId,
    "latestMessageId"
  );
  if (latestMessageId) {
    createMessageId(latestMessageId);
  }

  const latestMessageBodyPreview = optionalNonEmptyString(
    input.latestMessageBodyPreview,
    "latestMessageBodyPreview"
  );

  let latestActivityAt = null;
  if (input.latestActivityAt != null && input.latestActivityAt !== "") {
    latestActivityAt = requireValidTimestamp(
      input.latestActivityAt,
      "latestActivityAt"
    );
  }

  const unreadCount =
    input.unreadCount == null ? 0 : Number(input.unreadCount);
  if (!Number.isInteger(unreadCount) || unreadCount < 0) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "unreadCount must be a non-negative integer",
      { unreadCount: input.unreadCount }
    );
  }

  const hasUnread =
    typeof input.hasUnread === "boolean" ? input.hasUnread : unreadCount > 0;

  const participantAccessState = requireOpaqueId(
    input.participantAccessState ?? "UNKNOWN",
    "participantAccessState"
  );

  const rawPins = Array.isArray(input.pinnedMessageIds)
    ? input.pinnedMessageIds
    : [];
  const pinnedMessageIds = Object.freeze(
    rawPins.map((id) => createMessageId(id))
  );

  return deepFreeze({
    conversationId,
    clubId,
    channelKind: String(input.channelKind),
    channelKey,
    name,
    status: String(input.status),
    viewerParticipantId,
    latestMessageId,
    latestMessageBodyPreview,
    latestActivityAt,
    unreadCount,
    hasUnread,
    participantAccessState,
    pinnedMessageIds,
  });
}

/**
 * Deterministic sort: latest activity desc, then channelKey asc.
 * @param {Readonly<ClubChannelSummaryContract>} a
 * @param {Readonly<ClubChannelSummaryContract>} b
 * @returns {number}
 */
export function compareClubChannelSummaries(a, b) {
  const aMs =
    a.latestActivityAt == null
      ? -Infinity
      : timestampSortValue(a.latestActivityAt);
  const bMs =
    b.latestActivityAt == null
      ? -Infinity
      : timestampSortValue(b.latestActivityAt);
  if (aMs !== bMs) return bMs - aMs;
  if (a.channelKey < b.channelKey) return -1;
  if (a.channelKey > b.channelKey) return 1;
  return 0;
}
