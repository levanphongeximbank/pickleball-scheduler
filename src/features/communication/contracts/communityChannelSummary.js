/**
 * Deterministic community channel summary projection (COMMS-04).
 * Identifiers + channel metadata only — no avatar / tenant branding / profile SoT.
 */

import { isConversationStatus } from "../constants/conversationStatus.js";
import { isCommunityChannelKind } from "../constants/communityChannelKinds.js";
import { isCommunityChannelVisibility } from "../constants/communityChannelVisibility.js";
import { isCommunityChannelLifecycle } from "../constants/communityChannelLifecycle.js";
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
 * @typedef {Object} CommunityChannelSummaryContract
 * @property {string} conversationId
 * @property {string} tenantId
 * @property {string} channelKind
 * @property {string} visibility
 * @property {string} channelKey
 * @property {string|null} name
 * @property {string} status
 * @property {string} lifecycleStatus
 * @property {string} viewerParticipantId
 * @property {string|null} latestMessageId
 * @property {string|null} latestMessageBodyPreview
 * @property {string|number|null} latestActivityAt
 * @property {number} unreadCount
 * @property {boolean} hasUnread
 * @property {string} participantAccessState
 * @property {string} accessDecision
 * @property {number} slowModeIntervalSeconds
 * @property {readonly string[]} pinnedMessageIds
 */

/**
 * @param {object} input
 * @returns {Readonly<CommunityChannelSummaryContract>}
 */
export function createCommunityChannelSummaryContract(input = {}) {
  const conversationId = createConversationId(input.conversationId);
  const tenantId = requireOpaqueId(input.tenantId, "tenantId");
  if (!isCommunityChannelKind(input.channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_KIND,
      `Unsupported community channel kind in summary: ${String(input.channelKind)}`,
      { channelKind: input.channelKind }
    );
  }
  if (!isCommunityChannelVisibility(input.visibility)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_VISIBILITY,
      `Unsupported community visibility in summary: ${String(input.visibility)}`,
      { visibility: input.visibility }
    );
  }
  const channelKey = requireOpaqueId(input.channelKey, "channelKey");
  const name = optionalNonEmptyString(input.name, "name");
  if (!isConversationStatus(input.status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_STATUS,
      `Unsupported conversation status in community summary: ${String(input.status)}`,
      { status: input.status }
    );
  }
  const lifecycleStatus =
    input.lifecycleStatus == null ? "ACTIVE" : input.lifecycleStatus;
  if (!isCommunityChannelLifecycle(lifecycleStatus)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported community lifecycle in summary: ${String(lifecycleStatus)}`,
      { lifecycleStatus }
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

  const accessDecision = requireOpaqueId(
    input.accessDecision ?? "DENY",
    "accessDecision"
  );

  const slowModeIntervalSeconds =
    input.slowModeIntervalSeconds == null
      ? 0
      : Number(input.slowModeIntervalSeconds);
  if (
    !Number.isInteger(slowModeIntervalSeconds) ||
    slowModeIntervalSeconds < 0
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_SLOW_MODE_INTERVAL,
      "slowModeIntervalSeconds must be a non-negative integer",
      { slowModeIntervalSeconds: input.slowModeIntervalSeconds }
    );
  }

  const rawPins = Array.isArray(input.pinnedMessageIds)
    ? input.pinnedMessageIds
    : [];
  const pinnedMessageIds = Object.freeze(
    rawPins.map((id) => createMessageId(id))
  );

  return deepFreeze({
    conversationId,
    tenantId,
    channelKind: String(input.channelKind),
    visibility: String(input.visibility),
    channelKey,
    name,
    status: String(input.status),
    lifecycleStatus: String(lifecycleStatus),
    viewerParticipantId,
    latestMessageId,
    latestMessageBodyPreview,
    latestActivityAt,
    unreadCount,
    hasUnread,
    participantAccessState,
    accessDecision,
    slowModeIntervalSeconds,
    pinnedMessageIds,
  });
}

/**
 * Deterministic sort: latest activity desc, then channelKey asc.
 * @param {Readonly<CommunityChannelSummaryContract>} a
 * @param {Readonly<CommunityChannelSummaryContract>} b
 * @returns {number}
 */
export function compareCommunityChannelSummaries(a, b) {
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
