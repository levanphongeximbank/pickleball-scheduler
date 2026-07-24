/**
 * In-memory Community Communication repositories (COMMS-04) — unit tests only.
 *
 * NOT production persistence. Each createInMemoryCommunityCommunicationRepositories()
 * call returns an isolated store.
 */

import { COMMUNITY_RESTRICTION_SCOPE } from "../constants/communityRestrictionStatus.js";
import { clonePlain, deepFreeze, timestampSortValue } from "../contracts/shared.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeClone(value) {
  return deepFreeze(clonePlain(value));
}

/**
 * @returns {object}
 */
export function createInMemoryCommunityCommunicationRepositories() {
  /** @type {Map<string, object>} */
  const channelsById = new Map();
  /** @type {Map<string, string>} */
  const conversationIdByChannelKey = new Map();
  /** @type {Map<string, object>} */
  const messagesById = new Map();
  /** @type {Map<string, string[]>} */
  const messageIdsByConversation = new Map();
  /** @type {Map<string, object>} */
  const readCursors = new Map();
  /** @type {Map<string, object>} */
  const pinsByKey = new Map();
  /** @type {Map<string, object>} */
  const restrictionsByKey = new Map();
  /** @type {Map<string, object>} */
  const reportsById = new Map();
  /** @type {Map<string, object[]>} */
  const moderationByConversation = new Map();

  function cursorKey(conversationId, participantId) {
    return `${conversationId}\u0000${participantId}`;
  }

  function pinKey(conversationId, messageId) {
    return `${conversationId}\u0000${messageId}`;
  }

  function restrictionKey(tenantId, participantId, channelKey = null) {
    return `${tenantId}\u0000${participantId}\u0000${channelKey ?? ""}`;
  }

  const channels = {
    port: "CommunityChannelRepository",
    findById(conversationId) {
      const found = channelsById.get(String(conversationId));
      return found ? freezeClone(found) : null;
    },
    findByChannelKey(channelKey) {
      const id = conversationIdByChannelKey.get(String(channelKey));
      if (!id) return null;
      return this.findById(id);
    },
    listByTenantId(tenantId) {
      const id = String(tenantId);
      const out = [];
      for (const aggregate of channelsById.values()) {
        if (aggregate.tenantId === id) out.push(freezeClone(aggregate));
      }
      return out;
    },
    save(aggregate) {
      const conversationId = aggregate.conversation.conversationId;
      const channelKey = aggregate.channelKey;
      const existingByKey = conversationIdByChannelKey.get(channelKey);
      if (existingByKey && existingByKey !== conversationId) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_COMMUNITY_CHANNEL,
          "A community channel already exists for this channelKey",
          {
            channelKey,
            existingConversationId: existingByKey,
            conversationId,
          }
        );
      }
      const existing = channelsById.get(conversationId);
      if (existing) {
        if (existing.tenantId !== aggregate.tenantId) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH,
            "Community channel cannot be moved to a different tenant",
            {
              conversationId,
              existingTenantId: existing.tenantId,
              nextTenantId: aggregate.tenantId,
            }
          );
        }
        if (existing.channelKey !== channelKey) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_KEY_IMMUTABLE,
            "channelKey is immutable",
            {
              conversationId,
              existingKey: existing.channelKey,
              nextKey: channelKey,
            }
          );
        }
      }
      const stored = freezeClone(aggregate);
      channelsById.set(conversationId, stored);
      conversationIdByChannelKey.set(channelKey, conversationId);
      return freezeClone(stored);
    },
  };

  const messages = {
    port: "CommunityMessageRepository",
    findById(messageId) {
      const found = messagesById.get(String(messageId));
      return found ? freezeClone(found) : null;
    },
    listByConversationId(conversationId) {
      const ids = messageIdsByConversation.get(String(conversationId)) || [];
      return ids
        .map((id) => messagesById.get(id))
        .filter(Boolean)
        .map((m) => freezeClone(m));
    },
    findLatestByConversationId(conversationId) {
      const list = this.listByConversationId(conversationId);
      if (list.length === 0) return null;
      list.sort((a, b) => {
        const diff =
          timestampSortValue(a.createdAt) - timestampSortValue(b.createdAt);
        if (diff !== 0) return diff;
        if (a.messageId < b.messageId) return -1;
        if (a.messageId > b.messageId) return 1;
        return 0;
      });
      return list[list.length - 1];
    },
    findLatestBySender(conversationId, senderParticipantId) {
      const list = this.listByConversationId(conversationId).filter(
        (m) => m.senderParticipantId === String(senderParticipantId)
      );
      if (list.length === 0) return null;
      list.sort((a, b) => {
        const diff =
          timestampSortValue(a.createdAt) - timestampSortValue(b.createdAt);
        if (diff !== 0) return diff;
        if (a.messageId < b.messageId) return -1;
        if (a.messageId > b.messageId) return 1;
        return 0;
      });
      return list[list.length - 1];
    },
    save(message) {
      if (messagesById.has(message.messageId)) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "Message already exists",
          { messageId: message.messageId }
        );
      }
      const stored = freezeClone(message);
      messagesById.set(message.messageId, stored);
      const list =
        messageIdsByConversation.get(message.conversationId) || [];
      list.push(message.messageId);
      messageIdsByConversation.set(message.conversationId, list);
      return freezeClone(stored);
    },
    update(message) {
      if (!messagesById.has(message.messageId)) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "Message not found for update",
          { messageId: message.messageId }
        );
      }
      const stored = freezeClone(message);
      messagesById.set(message.messageId, stored);
      return freezeClone(stored);
    },
  };

  const readCursorsRepo = {
    port: "CommunityReadCursorRepository",
    find(conversationId, participantId) {
      const found = readCursors.get(cursorKey(conversationId, participantId));
      return found ? freezeClone(found) : null;
    },
    save(cursor) {
      const stored = freezeClone(cursor);
      readCursors.set(
        cursorKey(cursor.conversationId, cursor.participantId),
        stored
      );
      return freezeClone(stored);
    },
  };

  const pins = {
    port: "CommunityPinnedMessageRepository",
    listByConversationId(conversationId) {
      const id = String(conversationId);
      const out = [];
      for (const pin of pinsByKey.values()) {
        if (pin.conversationId === id) out.push(freezeClone(pin));
      }
      out.sort((a, b) => {
        const diff =
          timestampSortValue(a.pinnedAt) - timestampSortValue(b.pinnedAt);
        if (diff !== 0) return diff;
        if (a.messageId < b.messageId) return -1;
        if (a.messageId > b.messageId) return 1;
        return 0;
      });
      return out;
    },
    find(conversationId, messageId) {
      const found = pinsByKey.get(pinKey(conversationId, messageId));
      return found ? freezeClone(found) : null;
    },
    save(pin) {
      const key = pinKey(pin.conversationId, pin.messageId);
      if (pinsByKey.has(key)) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN,
          "Message is already pinned in this channel",
          {
            conversationId: pin.conversationId,
            messageId: pin.messageId,
          }
        );
      }
      const stored = freezeClone(pin);
      pinsByKey.set(key, stored);
      return freezeClone(stored);
    },
    remove(conversationId, messageId) {
      const key = pinKey(conversationId, messageId);
      if (!pinsByKey.has(key)) return false;
      pinsByKey.delete(key);
      return true;
    },
  };

  const restrictions = {
    port: "CommunityRestrictionRepository",
    find(tenantId, participantId, channelKey = null) {
      const community = restrictionsByKey.get(
        restrictionKey(tenantId, participantId, null)
      );
      if (community) return freezeClone(community);
      if (channelKey) {
        const channel = restrictionsByKey.get(
          restrictionKey(tenantId, participantId, channelKey)
        );
        if (channel) return freezeClone(channel);
      }
      return null;
    },
    save(restriction) {
      const key = restrictionKey(
        restriction.tenantId,
        restriction.participantId,
        restriction.scope === COMMUNITY_RESTRICTION_SCOPE.CHANNEL
          ? restriction.channelKey
          : null
      );
      const stored = freezeClone(restriction);
      restrictionsByKey.set(key, stored);
      return freezeClone(stored);
    },
    clear(tenantId, participantId, channelKey = null) {
      const key = restrictionKey(tenantId, participantId, channelKey);
      if (!restrictionsByKey.has(key)) return false;
      restrictionsByKey.delete(key);
      return true;
    },
  };

  const reports = {
    port: "CommunityReportRepository",
    save(report) {
      const stored = freezeClone(report);
      reportsById.set(report.reportId, stored);
      return freezeClone(stored);
    },
    findById(reportId) {
      const found = reportsById.get(String(reportId));
      return found ? freezeClone(found) : null;
    },
  };

  const moderationActions = {
    port: "CommunityModerationActionRepository",
    save(action) {
      const stored = freezeClone(action);
      const list =
        moderationByConversation.get(action.conversationId) || [];
      list.push(stored);
      moderationByConversation.set(action.conversationId, list);
      return freezeClone(stored);
    },
    listByConversationId(conversationId) {
      const list =
        moderationByConversation.get(String(conversationId)) || [];
      return list.map((a) => freezeClone(a));
    },
  };

  return Object.freeze({
    channels,
    messages,
    readCursors: readCursorsRepo,
    pins,
    restrictions,
    reports,
    moderationActions,
    isTestDoubleOnly: true,
  });
}
