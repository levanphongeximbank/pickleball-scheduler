/**
 * In-memory Club Communication repositories (COMMS-03) — unit tests only.
 *
 * NOT production persistence. Each createInMemoryClubCommunicationRepositories()
 * call returns an isolated store.
 */

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
export function createInMemoryClubCommunicationRepositories() {
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

  function cursorKey(conversationId, participantId) {
    return `${conversationId}\u0000${participantId}`;
  }

  function pinKey(conversationId, messageId) {
    return `${conversationId}\u0000${messageId}`;
  }

  const channels = {
    port: "ClubChannelRepository",
    findById(conversationId) {
      const found = channelsById.get(String(conversationId));
      return found ? freezeClone(found) : null;
    },
    findByChannelKey(channelKey) {
      const id = conversationIdByChannelKey.get(String(channelKey));
      if (!id) return null;
      return this.findById(id);
    },
    listByClubId(clubId) {
      const id = String(clubId);
      const out = [];
      for (const aggregate of channelsById.values()) {
        if (aggregate.clubId === id) out.push(freezeClone(aggregate));
      }
      return out;
    },
    save(aggregate) {
      const conversationId = aggregate.conversation.conversationId;
      const channelKey = aggregate.channelKey;
      const existingByKey = conversationIdByChannelKey.get(channelKey);
      if (existingByKey && existingByKey !== conversationId) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_CLUB_CHANNEL,
          "A club channel already exists for this channelKey",
          {
            channelKey,
            existingConversationId: existingByKey,
            conversationId,
          }
        );
      }
      const existing = channelsById.get(conversationId);
      if (existing) {
        if (existing.clubId !== aggregate.clubId) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH,
            "Club channel cannot be moved to a different club",
            {
              conversationId,
              existingClubId: existing.clubId,
              nextClubId: aggregate.clubId,
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
    port: "ClubMessageRepository",
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
  };

  const readCursorsRepo = {
    port: "ClubReadCursorRepository",
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
    port: "ClubPinnedMessageRepository",
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

  return Object.freeze({
    channels,
    messages,
    readCursors: readCursorsRepo,
    pins,
    isTestDoubleOnly: true,
  });
}
