/**
 * COMMS-05 row ↔ canonical domain mappers.
 * Never export raw Supabase rows from public adapter APIs.
 */

import { createConversationContract } from "../../contracts/conversation.js";
import { createConversationParticipantContract } from "../../contracts/participant.js";
import { createMessageContract } from "../../contracts/message.js";
import { createReadCursorContract } from "../../contracts/readCursor.js";
import { createConversationRequestContract } from "../../contracts/conversationRequest.js";
import { createClubPinnedMessageContract } from "../../contracts/clubPinnedMessage.js";
import { createCommunityPinnedMessageContract } from "../../contracts/communityPinnedMessage.js";
import { createUserBlockContract } from "../../contracts/userBlock.js";
import { createMessageReportContract } from "../../contracts/messageReport.js";
import { createModerationActionContract } from "../../contracts/moderationAction.js";
import { createCommunityRestrictionContract } from "../../contracts/communityRestriction.js";
import { createReactionContract } from "../../contracts/reaction.js";
import { deepFreeze, clonePlain } from "../../contracts/shared.js";
import { malformedRowError } from "./errorMapping.js";

function toIso(value) {
  if (value == null) return value;
  if (typeof value === "number") return new Date(value).toISOString();
  return String(value);
}

/**
 * @param {object} row
 */
export function conversationFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("Conversation", { field: "row" });
  }
  try {
    return createConversationContract({
      conversationId: row.conversation_id,
      type: row.conversation_type,
      status: row.status,
      tenantId: row.tenant_id,
      clubId: row.club_id,
      contextRef: row.context_ref,
      createdAt: toIso(row.created_at),
      createdByParticipantId: row.created_by_participant_id,
    });
  } catch (err) {
    throw malformedRowError("Conversation", {
      conversationId: row.conversation_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} conversation
 * @param {object} [meta]
 */
export function conversationToRow(conversation, meta = {}) {
  return {
    conversation_id: conversation.conversationId,
    conversation_type: conversation.type,
    status: conversation.status,
    tenant_id: conversation.tenantId ?? null,
    club_id: conversation.clubId ?? null,
    context_ref: conversation.contextRef ?? null,
    created_at: toIso(conversation.createdAt),
    created_by_participant_id: conversation.createdByParticipantId ?? null,
    channel_key: meta.channelKey ?? null,
    channel_kind: meta.channelKind ?? null,
    channel_name: meta.name ?? meta.channelName ?? null,
    channel_visibility: meta.visibility ?? null,
    lifecycle_status: meta.lifecycleStatus ?? null,
    slow_mode_interval_seconds:
      meta.slowModeIntervalSeconds == null ? 0 : Number(meta.slowModeIntervalSeconds),
    direct_pair_key: meta.pairKey ?? meta.directPairKey ?? null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * @param {object} row
 */
export function participantFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("Participant", { field: "row" });
  }
  try {
    return createConversationParticipantContract({
      participantId: row.participant_id,
      conversationId: row.conversation_id,
      role: row.role,
      status: row.status,
      joinedAt: toIso(row.joined_at),
      playerId: row.player_id,
      mutedUntil: row.muted_until == null ? null : toIso(row.muted_until),
    });
  } catch (err) {
    throw malformedRowError("Participant", {
      participantId: row.participant_id,
      conversationId: row.conversation_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} participant
 */
export function participantToRow(participant) {
  return {
    conversation_id: participant.conversationId,
    participant_id: participant.participantId,
    role: participant.role,
    status: participant.status,
    joined_at: toIso(participant.joinedAt),
    player_id: participant.playerId ?? null,
    muted_until: participant.mutedUntil == null ? null : toIso(participant.mutedUntil),
    updated_at: new Date().toISOString(),
  };
}

/**
 * @param {object} row
 */
export function messageFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("Message", { field: "row" });
  }
  let attachmentRefs = [];
  if (Array.isArray(row.attachment_refs)) {
    attachmentRefs = row.attachment_refs;
  } else if (typeof row.attachment_refs === "string") {
    try {
      attachmentRefs = JSON.parse(row.attachment_refs);
    } catch {
      attachmentRefs = [];
    }
  }
  try {
    const message = createMessageContract({
      messageId: row.message_id,
      conversationId: row.conversation_id,
      senderParticipantId: row.sender_participant_id,
      body: row.body,
      status: row.status,
      createdAt: toIso(row.created_at),
      updatedAt: row.updated_at == null ? null : toIso(row.updated_at),
      replyToMessageId: row.reply_to_message_id,
      attachmentRefs,
    });
    return deepFreeze({
      ...clonePlain(message),
      position: row.position == null ? null : Number(row.position),
      clientIdempotencyKey: row.client_idempotency_key ?? null,
    });
  } catch (err) {
    throw malformedRowError("Message", {
      messageId: row.message_id,
      conversationId: row.conversation_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} message
 * @param {{ position: number, clientIdempotencyKey?: string|null }} ordering
 */
export function messageToRow(message, ordering) {
  return {
    message_id: message.messageId,
    conversation_id: message.conversationId,
    sender_participant_id: message.senderParticipantId,
    body: message.body,
    status: message.status,
    created_at: toIso(message.createdAt),
    updated_at: message.updatedAt == null ? null : toIso(message.updatedAt),
    reply_to_message_id: message.replyToMessageId ?? null,
    attachment_refs: Array.isArray(message.attachmentRefs)
      ? message.attachmentRefs
      : [],
    position: ordering.position,
    client_idempotency_key: ordering.clientIdempotencyKey ?? null,
  };
}

/**
 * @param {object} row
 */
export function readCursorFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("ReadCursor", { field: "row" });
  }
  try {
    const cursor = createReadCursorContract({
      conversationId: row.conversation_id,
      participantId: row.participant_id,
      lastReadAt: toIso(row.last_read_at),
      lastReadMessageId: row.last_read_message_id,
    });
    return deepFreeze({
      ...clonePlain(cursor),
      lastReadPosition:
        row.last_read_position == null ? null : Number(row.last_read_position),
    });
  } catch (err) {
    throw malformedRowError("ReadCursor", {
      conversationId: row.conversation_id,
      participantId: row.participant_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} cursor
 */
export function readCursorToRow(cursor) {
  return {
    conversation_id: cursor.conversationId,
    participant_id: cursor.participantId,
    last_read_at: toIso(cursor.lastReadAt),
    last_read_message_id: cursor.lastReadMessageId ?? null,
    last_read_position:
      cursor.lastReadPosition == null ? null : Number(cursor.lastReadPosition),
    updated_at: new Date().toISOString(),
  };
}

/**
 * @param {object} row
 */
export function directRequestFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("ConversationRequest", { field: "row" });
  }
  try {
    return createConversationRequestContract({
      requestId: row.request_id,
      pairKey: row.pair_key,
      requesterParticipantId: row.requester_participant_id,
      recipientParticipantId: row.recipient_participant_id,
      status: row.status,
      createdAt: toIso(row.created_at),
      updatedAt: row.updated_at == null ? null : toIso(row.updated_at),
      message: row.message,
    });
  } catch (err) {
    throw malformedRowError("ConversationRequest", {
      requestId: row.request_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} request
 */
export function directRequestToRow(request) {
  return {
    request_id: request.requestId,
    pair_key: request.pairKey,
    requester_participant_id: request.requesterParticipantId,
    recipient_participant_id: request.recipientParticipantId,
    status: request.status,
    created_at: toIso(request.createdAt),
    updated_at: request.updatedAt == null ? null : toIso(request.updatedAt),
    message: request.message ?? null,
  };
}

/**
 * @param {object} row
 * @param {"club"|"community"} surface
 */
export function pinnedMessageFromRow(row, surface = "club") {
  if (!row || typeof row !== "object") {
    throw malformedRowError("PinnedMessage", { field: "row" });
  }
  const input = {
    conversationId: row.conversation_id,
    messageId: row.message_id,
    pinnedByParticipantId: row.pinned_by_participant_id,
    pinnedAt: toIso(row.pinned_at),
  };
  try {
    return surface === "community"
      ? createCommunityPinnedMessageContract(input)
      : createClubPinnedMessageContract(input);
  } catch (err) {
    throw malformedRowError("PinnedMessage", {
      conversationId: row.conversation_id,
      messageId: row.message_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} pin
 */
export function pinnedMessageToRow(pin) {
  return {
    conversation_id: pin.conversationId,
    message_id: pin.messageId,
    pinned_by_participant_id: pin.pinnedByParticipantId,
    pinned_at: toIso(pin.pinnedAt),
  };
}

/**
 * @param {object} row
 */
export function userBlockFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("UserBlock", { field: "row" });
  }
  try {
    return createUserBlockContract({
      blockId: row.block_id,
      blockerParticipantId: row.blocker_participant_id,
      blockedParticipantId: row.blocked_participant_id,
      createdAt: toIso(row.created_at),
      reason: row.reason,
    });
  } catch (err) {
    throw malformedRowError("UserBlock", { code: err?.code });
  }
}

/**
 * @param {object} block
 */
export function userBlockToRow(block) {
  return {
    block_id: block.blockId,
    blocker_participant_id: block.blockerParticipantId,
    blocked_participant_id: block.blockedParticipantId,
    created_at: toIso(block.createdAt),
    reason: block.reason ?? null,
  };
}

/**
 * @param {object} row
 */
export function messageReportFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("MessageReport", { field: "row" });
  }
  try {
    return createMessageReportContract({
      reportId: row.report_id,
      messageId: row.message_id,
      conversationId: row.conversation_id,
      reporterParticipantId: row.reporter_participant_id,
      reason: row.reason,
      createdAt: toIso(row.created_at),
      details: row.details,
    });
  } catch (err) {
    throw malformedRowError("MessageReport", {
      reportId: row.report_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} report
 */
export function messageReportToRow(report) {
  return {
    report_id: report.reportId,
    message_id: report.messageId,
    conversation_id: report.conversationId,
    reporter_participant_id: report.reporterParticipantId,
    reason: report.reason,
    created_at: toIso(report.createdAt),
    details: report.details ?? null,
  };
}

/**
 * @param {object} row
 */
export function moderationActionFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("ModerationAction", { field: "row" });
  }
  try {
    return createModerationActionContract({
      actionId: row.action_id,
      type: row.action_type,
      conversationId: row.conversation_id,
      actorParticipantId: row.actor_participant_id,
      targetParticipantId: row.target_participant_id,
      targetMessageId: row.target_message_id,
      createdAt: toIso(row.created_at),
      reason: row.reason,
    });
  } catch (err) {
    throw malformedRowError("ModerationAction", {
      actionId: row.action_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} action
 */
export function moderationActionToRow(action) {
  return {
    action_id: action.actionId,
    action_type: action.type,
    conversation_id: action.conversationId,
    actor_participant_id: action.actorParticipantId,
    target_participant_id: action.targetParticipantId ?? null,
    target_message_id: action.targetMessageId ?? null,
    created_at: toIso(action.createdAt),
    reason: action.reason ?? null,
  };
}

/**
 * @param {object} row
 */
export function communityRestrictionFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("CommunityRestriction", { field: "row" });
  }
  try {
    return createCommunityRestrictionContract({
      tenantId: row.tenant_id,
      participantId: row.participant_id,
      status: row.status,
      scope: row.scope,
      channelKey: row.channel_key,
      reasonCode: row.reason_code,
      reason: row.reason,
      updatedAt: toIso(row.updated_at),
    });
  } catch (err) {
    throw malformedRowError("CommunityRestriction", {
      tenantId: row.tenant_id,
      participantId: row.participant_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} restriction
 */
export function communityRestrictionToRow(restriction) {
  return {
    tenant_id: restriction.tenantId,
    participant_id: restriction.participantId,
    status: restriction.status,
    scope: restriction.scope,
    channel_key: restriction.channelKey ?? null,
    reason_code: restriction.reasonCode ?? null,
    reason: restriction.reason ?? null,
    updated_at: toIso(restriction.updatedAt),
  };
}

/**
 * @param {object} row
 */
export function reactionFromRow(row) {
  if (!row || typeof row !== "object") {
    throw malformedRowError("Reaction", { field: "row" });
  }
  try {
    return createReactionContract({
      reactionId: row.reaction_id,
      messageId: row.message_id,
      conversationId: row.conversation_id,
      participantId: row.participant_id,
      emoji: row.emoji,
      createdAt: toIso(row.created_at),
    });
  } catch (err) {
    throw malformedRowError("Reaction", {
      reactionId: row.reaction_id,
      code: err?.code,
    });
  }
}

/**
 * @param {object} conversationRow
 * @param {object[]} participantRows
 * @param {"direct"|"club"|"community"} kind
 */
export function channelAggregateFromRows(conversationRow, participantRows, kind) {
  const conversation = conversationFromRow(conversationRow);
  const participants = (participantRows || []).map(participantFromRow);
  if (kind === "direct") {
    return deepFreeze({
      conversation,
      participants,
      pairKey: conversationRow.direct_pair_key,
    });
  }
  if (kind === "club") {
    return deepFreeze({
      conversation,
      participants,
      clubId: conversationRow.club_id,
      channelKind: conversationRow.channel_kind,
      channelKey: conversationRow.channel_key,
      name: conversationRow.channel_name ?? null,
    });
  }
  return deepFreeze({
    conversation,
    participants,
    tenantId: conversationRow.tenant_id,
    channelKind: conversationRow.channel_kind,
    visibility: conversationRow.channel_visibility,
    channelKey: conversationRow.channel_key,
    name: conversationRow.channel_name ?? null,
    lifecycleStatus: conversationRow.lifecycle_status,
    slowModeIntervalSeconds: Number(conversationRow.slow_mode_interval_seconds || 0),
  });
}
