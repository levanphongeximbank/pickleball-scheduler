/**
 * In-memory Communication repositories (COMMS-02) — unit tests / capability proof only.
 *
 * NOT production persistence. Each createInMemoryDirectMessagingRepositories()
 * call returns an isolated store. Do not advertise as production repository.
 */

import { CONVERSATION_REQUEST_STATUS } from "../constants/conversationRequestStatus.js";
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
 * Create an isolated in-memory repository bundle for Direct Messaging tests.
 * @returns {object}
 */
export function createInMemoryDirectMessagingRepositories() {
  /** @type {Map<string, object>} */
  const conversationsById = new Map();
  /** @type {Map<string, string>} */
  const conversationIdByPairKey = new Map();
  /** @type {Map<string, object>} */
  const requestsById = new Map();
  /** @type {Map<string, string>} */
  const pendingRequestIdByPairKey = new Map();
  /** @type {Map<string, object>} */
  const messagesById = new Map();
  /** @type {Map<string, string[]>} */
  const messageIdsByConversation = new Map();
  /** @type {Map<string, object>} */
  const readCursors = new Map();
  /** @type {Set<string>} */
  const blockEdges = new Set();

  function cursorKey(conversationId, participantId) {
    return `${conversationId}\u0000${participantId}`;
  }

  function blockKey(a, b) {
    return `${a}\u0000${b}`;
  }

  const conversations = {
    port: "DirectConversationRepository",
    findById(conversationId) {
      const found = conversationsById.get(String(conversationId));
      return found ? freezeClone(found) : null;
    },
    findByPairKey(pairKey) {
      const id = conversationIdByPairKey.get(String(pairKey));
      if (!id) return null;
      return this.findById(id);
    },
    listByParticipantId(participantId) {
      const id = String(participantId);
      const out = [];
      for (const aggregate of conversationsById.values()) {
        const member = (aggregate.participants || []).some(
          (p) => p.participantId === id
        );
        if (member) out.push(freezeClone(aggregate));
      }
      return out;
    },
    save(aggregate) {
      const conversationId = aggregate.conversation.conversationId;
      const pairKey = aggregate.pairKey;
      const existingByPair = conversationIdByPairKey.get(pairKey);
      if (existingByPair && existingByPair !== conversationId) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_DIRECT_CONVERSATION,
          "A direct conversation already exists for this pair",
          { pairKey, existingConversationId: existingByPair, conversationId }
        );
      }
      const existing = conversationsById.get(conversationId);
      if (existing && existing.pairKey !== pairKey) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_DIRECT_CONVERSATION,
          "Conversation id is already bound to a different pair",
          {
            conversationId,
            existingPairKey: existing.pairKey,
            pairKey,
          }
        );
      }
      const stored = freezeClone(aggregate);
      conversationsById.set(conversationId, stored);
      conversationIdByPairKey.set(pairKey, conversationId);
      return freezeClone(stored);
    },
  };

  const requests = {
    port: "DirectConversationRequestRepository",
    findById(requestId) {
      const found = requestsById.get(String(requestId));
      return found ? freezeClone(found) : null;
    },
    findPendingByPairKey(pairKey) {
      const id = pendingRequestIdByPairKey.get(String(pairKey));
      if (!id) return null;
      const found = requestsById.get(id);
      if (!found || found.status !== CONVERSATION_REQUEST_STATUS.PENDING) {
        return null;
      }
      return freezeClone(found);
    },
    save(request) {
      if (request.status === CONVERSATION_REQUEST_STATUS.PENDING) {
        const existingPending = pendingRequestIdByPairKey.get(request.pairKey);
        if (existingPending && existingPending !== request.requestId) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PENDING_REQUEST,
            "A pending conversation request already exists for this pair",
            {
              pairKey: request.pairKey,
              existingRequestId: existingPending,
              requestId: request.requestId,
            }
          );
        }
      }
      if (requestsById.has(request.requestId)) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "Conversation request already exists",
          { requestId: request.requestId }
        );
      }
      const stored = freezeClone(request);
      requestsById.set(request.requestId, stored);
      if (request.status === CONVERSATION_REQUEST_STATUS.PENDING) {
        pendingRequestIdByPairKey.set(request.pairKey, request.requestId);
      }
      return freezeClone(stored);
    },
    update(request) {
      if (!requestsById.has(request.requestId)) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.REQUEST_NOT_FOUND,
          `Conversation request not found: ${request.requestId}`,
          { requestId: request.requestId }
        );
      }
      const stored = freezeClone(request);
      requestsById.set(request.requestId, stored);
      if (request.status === CONVERSATION_REQUEST_STATUS.PENDING) {
        pendingRequestIdByPairKey.set(request.pairKey, request.requestId);
      } else {
        const pendingId = pendingRequestIdByPairKey.get(request.pairKey);
        if (pendingId === request.requestId) {
          pendingRequestIdByPairKey.delete(request.pairKey);
        }
      }
      return freezeClone(stored);
    },
    /**
     * Demo / test helper — not part of DirectConversationRequestRepository port.
     * @returns {object[]}
     */
    listAll() {
      return [...requestsById.values()].map((r) => freezeClone(r));
    },
  };

  const messages = {
    port: "DirectMessageRepository",
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
    port: "DirectReadCursorRepository",
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

  const blockState = {
    port: "BlockStateReader",
    /**
     * Test helper — seed a directional block edge.
     * @param {string} blockerParticipantId
     * @param {string} blockedParticipantId
     */
    seedBlock(blockerParticipantId, blockedParticipantId) {
      blockEdges.add(
        blockKey(String(blockerParticipantId), String(blockedParticipantId))
      );
    },
    isBlockedEitherWay(participantIdA, participantIdB) {
      const a = String(participantIdA);
      const b = String(participantIdB);
      return blockEdges.has(blockKey(a, b)) || blockEdges.has(blockKey(b, a));
    },
  };

  return Object.freeze({
    conversations,
    requests,
    messages,
    readCursors: readCursorsRepo,
    blockState,
    /** @deprecated alias clarity for tests */
    isTestDoubleOnly: true,
  });
}
