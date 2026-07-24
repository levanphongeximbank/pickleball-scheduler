/**
 * Deterministic direct conversation inbox projection (COMMS-02).
 * Identifiers only — no display name, avatar, or rating.
 */

import { isConversationStatus } from "../constants/conversationStatus.js";
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
 * @typedef {Object} DirectConversationSummaryContract
 * @property {string} conversationId
 * @property {string} pairKey
 * @property {string} viewerParticipantId
 * @property {string} counterpartParticipantId
 * @property {string} status
 * @property {string|null} latestMessageId
 * @property {string|null} latestMessageBodyPreview
 * @property {string|number|null} latestActivityAt
 * @property {number} unreadCount
 * @property {boolean} hasUnread
 */

/**
 * @param {object} input
 * @returns {Readonly<DirectConversationSummaryContract>}
 */
export function createDirectConversationSummaryContract(input = {}) {
  const conversationId = createConversationId(input.conversationId);
  const pairKey = requireOpaqueId(input.pairKey, "pairKey");
  const viewerParticipantId = createParticipantId(input.viewerParticipantId);
  const counterpartParticipantId = createParticipantId(
    input.counterpartParticipantId
  );
  if (viewerParticipantId === counterpartParticipantId) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED,
      "Summary requires distinct viewer and counterpart",
      { viewerParticipantId, counterpartParticipantId }
    );
  }

  if (!isConversationStatus(input.status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_STATUS,
      `Unsupported conversation status in summary: ${String(input.status)}`,
      { status: input.status }
    );
  }

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

  return deepFreeze({
    conversationId,
    pairKey,
    viewerParticipantId,
    counterpartParticipantId,
    status: String(input.status),
    latestMessageId,
    latestMessageBodyPreview,
    latestActivityAt,
    unreadCount,
    hasUnread,
  });
}

/**
 * Deterministic sort: latest activity desc, then conversationId asc.
 * @param {Readonly<DirectConversationSummaryContract>} a
 * @param {Readonly<DirectConversationSummaryContract>} b
 * @returns {number}
 */
export function compareDirectConversationSummaries(a, b) {
  const aMs =
    a.latestActivityAt == null ? -Infinity : timestampSortValue(a.latestActivityAt);
  const bMs =
    b.latestActivityAt == null ? -Infinity : timestampSortValue(b.latestActivityAt);
  if (aMs !== bMs) return bMs - aMs;
  if (a.conversationId < b.conversationId) return -1;
  if (a.conversationId > b.conversationId) return 1;
  return 0;
}
