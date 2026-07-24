/**
 * Stable Messaging Experience view models (COMMS-06).
 * Never expose raw persistence / SQL rows to UI.
 */

import { MESSAGE_STATUS } from "../constants/messageLifecycle.js";
import { deepFreeze, clonePlain } from "../contracts/shared.js";
import {
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_PREVIEW_MAX_LENGTH,
} from "./constants.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function asPlainText(value) {
  if (value == null) return "";
  return String(value);
}

/**
 * Strip angle-bracket tags so message bodies stay text-only in UI.
 * Does not interpret HTML entities as markup.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeMessageBodyForDisplay(value) {
  return asPlainText(value).replace(/<[^>]*>/g, "");
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
export function truncatePreview(value, max = MESSAGE_PREVIEW_MAX_LENGTH) {
  const text = sanitizeMessageBodyForDisplay(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * @param {object} profile
 * @returns {Readonly<object>}
 */
export function createParticipantProjectionVm(profile = {}) {
  return deepFreeze({
    participantId: asPlainText(profile.participantId),
    displayName: asPlainText(profile.displayName || profile.participantId),
    avatarUrl: profile.avatarUrl ? asPlainText(profile.avatarUrl) : null,
    // Explicitly omit email / phone — never surface as identifiers in UI state.
  });
}

/**
 * @param {object} summary — DirectConversationSummaryContract-like
 * @param {object} [counterpart]
 * @returns {Readonly<object>}
 */
export function createDirectConversationListItemVm(summary, counterpart = {}) {
  return deepFreeze({
    kind: "DIRECT",
    conversationId: asPlainText(summary.conversationId),
    pairKey: asPlainText(summary.pairKey),
    status: asPlainText(summary.status),
    counterpart: createParticipantProjectionVm({
      participantId: summary.counterpartParticipantId,
      ...counterpart,
    }),
    latestMessageId: summary.latestMessageId
      ? asPlainText(summary.latestMessageId)
      : null,
    latestMessagePreview: truncatePreview(summary.latestMessageBodyPreview),
    latestActivityAt: summary.latestActivityAt ?? null,
    unreadCount: Number(summary.unreadCount) || 0,
    hasUnread: Boolean(summary.hasUnread),
  });
}

/**
 * @param {object} request
 * @param {object} [counterpart]
 * @returns {Readonly<object>}
 */
export function createDirectRequestListItemVm(request, counterpart = {}) {
  const recipientId = asPlainText(
    request.recipientParticipantId || request.targetParticipantId
  );
  const isIncoming =
    recipientId === asPlainText(request.viewerParticipantId);
  return deepFreeze({
    kind: "DIRECT_REQUEST",
    requestId: asPlainText(request.requestId),
    pairKey: asPlainText(request.pairKey),
    status: asPlainText(request.status),
    direction: isIncoming ? "INCOMING" : "OUTGOING",
    requesterParticipantId: asPlainText(request.requesterParticipantId),
    recipientParticipantId: recipientId,
    counterpart: createParticipantProjectionVm({
      participantId: isIncoming
        ? request.requesterParticipantId
        : recipientId,
      ...counterpart,
    }),
    messagePreview: truncatePreview(request.message || ""),
    createdAt: request.createdAt ?? null,
  });
}

/**
 * @param {object} summary — ClubChannelSummaryContract-like
 * @returns {Readonly<object>}
 */
export function createClubChannelListItemVm(summary) {
  return deepFreeze({
    kind: "CLUB",
    conversationId: asPlainText(summary.conversationId),
    clubId: asPlainText(summary.clubId),
    channelKind: asPlainText(summary.channelKind),
    channelKey: asPlainText(summary.channelKey),
    name: asPlainText(summary.name || summary.channelKey),
    participantAccessState: asPlainText(
      summary.participantAccessState || "DENIED"
    ),
    archived: Boolean(summary.archived || summary.lifecycleStatus === "ARCHIVED"),
    readOnly: Boolean(summary.readOnly),
    canSend: summary.canSend !== false && summary.participantAccessState !== "DENIED",
    canPin: Boolean(summary.canPin),
    canComposeAnnouncement: Boolean(summary.canComposeAnnouncement),
    latestMessagePreview: truncatePreview(summary.latestMessageBodyPreview),
    latestActivityAt: summary.latestActivityAt ?? null,
    unreadCount: Number(summary.unreadCount) || 0,
    hasUnread: Boolean(summary.hasUnread),
    pinnedMessageIds: Object.freeze(
      [...(summary.pinnedMessageIds || [])].map((id) => asPlainText(id))
    ),
  });
}

/**
 * @param {object} summary — CommunityChannelSummaryContract-like
 * @returns {Readonly<object>}
 */
export function createCommunityChannelListItemVm(summary) {
  return deepFreeze({
    kind: "COMMUNITY",
    conversationId: asPlainText(summary.conversationId),
    tenantId: asPlainText(summary.tenantId),
    channelKind: asPlainText(summary.channelKind),
    channelKey: asPlainText(summary.channelKey),
    name: asPlainText(summary.name || summary.channelKey),
    visibility: asPlainText(summary.visibility),
    lifecycleStatus: asPlainText(summary.lifecycleStatus || "ACTIVE"),
    participantAccessState: asPlainText(
      summary.participantAccessState || "DENIED"
    ),
    accessDecision: asPlainText(summary.accessDecision || "DENY"),
    slowModeIntervalSeconds: Number(summary.slowModeIntervalSeconds) || 0,
    canJoin: Boolean(summary.canJoin),
    canLeave: Boolean(summary.canLeave),
    canSend: Boolean(summary.canSend),
    canPin: Boolean(summary.canPin),
    canModerate: Boolean(summary.canModerate),
    canReport: summary.canReport !== false,
    readOnly: Boolean(summary.readOnly) || summary.accessDecision === "READ_ONLY",
    latestMessagePreview: truncatePreview(summary.latestMessageBodyPreview),
    latestActivityAt: summary.latestActivityAt ?? null,
    unreadCount: Number(summary.unreadCount) || 0,
    hasUnread: Boolean(summary.hasUnread),
    pinnedMessageIds: Object.freeze(
      [...(summary.pinnedMessageIds || [])].map((id) => asPlainText(id))
    ),
    ruleNotice: asPlainText(
      summary.ruleNotice ||
        "Tuân thủ quy tắc cộng đồng. Không chia sẻ thông tin cá nhân nhạy cảm."
    ),
  });
}

/**
 * @param {object} message
 * @param {{ viewerParticipantId?: string, pinnedMessageIds?: string[], sender?: object }} [ctx]
 * @returns {Readonly<object>}
 */
export function createMessageItemVm(message, ctx = {}) {
  const status = asPlainText(message.status || MESSAGE_STATUS.VISIBLE);
  const senderId = asPlainText(message.senderParticipantId);
  const pinnedIds = new Set((ctx.pinnedMessageIds || []).map(String));
  const hidden =
    status === MESSAGE_STATUS.DELETED || Boolean(message.hidden);
  return deepFreeze({
    messageId: asPlainText(message.messageId),
    conversationId: asPlainText(message.conversationId),
    sender: createParticipantProjectionVm({
      participantId: senderId,
      ...(ctx.sender || {}),
    }),
    body: hidden
      ? "[Tin nhắn đã bị ẩn hoặc gỡ]"
      : sanitizeMessageBodyForDisplay(message.body),
    status,
    createdAt: message.createdAt ?? null,
    updatedAt: message.updatedAt ?? null,
    replyToMessageId: message.replyToMessageId
      ? asPlainText(message.replyToMessageId)
      : null,
    replyPreview: message.replyPreview
      ? truncatePreview(message.replyPreview)
      : null,
    mine: senderId === asPlainText(ctx.viewerParticipantId),
    edited: status === MESSAGE_STATUS.EDITED,
    hidden,
    pinned: pinnedIds.has(asPlainText(message.messageId)),
    // Never include raw HTML / email / phone fields.
  });
}

/**
 * @param {object} decision
 * @returns {Readonly<object>}
 */
export function createAccessDecisionVm(decision = {}) {
  return deepFreeze({
    decision: asPlainText(decision.decision || "DENY"),
    reasonCode: decision.reasonCode ? asPlainText(decision.reasonCode) : null,
    message: asPlainText(
      decision.message ||
        (decision.decision === "ALLOW"
          ? "Được phép trò chuyện"
          : decision.decision === "REQUEST_REQUIRED"
            ? "Cần gửi yêu cầu trò chuyện"
            : "Không được phép trò chuyện")
    ),
  });
}

/**
 * @param {object} unread
 * @returns {Readonly<object>}
 */
export function createUnreadBadgeVm(unread = {}) {
  const direct = Number(unread.direct) || 0;
  const club = Number(unread.club) || 0;
  const community = Number(unread.community) || 0;
  const requests = Number(unread.requests) || 0;
  const total = direct + club + community + requests;
  return deepFreeze({
    direct,
    club,
    community,
    requests,
    total,
    hasUnread: total > 0,
  });
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, body: string }|{ ok: false, error: string }}
 */
export function validateComposerBody(body) {
  const text = asPlainText(body);
  if (!text.trim()) {
    return { ok: false, error: "Nội dung tin nhắn không được để trống" };
  }
  if (text.length > MESSAGE_BODY_MAX_LENGTH) {
    return {
      ok: false,
      error: `Tin nhắn tối đa ${MESSAGE_BODY_MAX_LENGTH} ký tự`,
    };
  }
  return { ok: true, body: text };
}

/**
 * Assert a view model is not a raw persistence row.
 * @param {object} vm
 * @returns {boolean}
 */
export function assertNotRawPersistenceRow(vm) {
  if (!vm || typeof vm !== "object") return true;
  const keys = Object.keys(vm);
  const forbidden = [
    "row",
    "sql",
    "supabase",
    "email",
    "phone",
    "phoneNumber",
    "rawRow",
    "dbRow",
  ];
  for (const key of keys) {
    if (forbidden.includes(key)) return false;
  }
  return true;
}

/**
 * @param {object} value
 * @returns {object}
 */
export function cloneVm(value) {
  return clonePlain(value);
}
