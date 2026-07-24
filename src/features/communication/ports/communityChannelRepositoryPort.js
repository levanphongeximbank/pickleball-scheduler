/**
 * Community channel / message / read-cursor / pinned-message repository ports (COMMS-04).
 * Persistence-agnostic. No Supabase / SQL wiring in this phase.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} CommunityChannelAggregate
 * @property {object} conversation
 * @property {readonly object[]} participants
 * @property {string} tenantId
 * @property {string} channelKind
 * @property {string} visibility
 * @property {string} channelKey
 * @property {string|null} name
 * @property {string} lifecycleStatus
 * @property {number} slowModeIntervalSeconds
 */

/**
 * @typedef {Object} CommunityChannelRepository
 * @property {(conversationId: string) => Promise<object|null>|object|null} findById
 * @property {(channelKey: string) => Promise<object|null>|object|null} findByChannelKey
 * @property {(tenantId: string) => Promise<object[]>|object[]} listByTenantId
 * @property {(aggregate: CommunityChannelAggregate) => Promise<object>|object} save
 */

export const COMMUNITY_CHANNEL_REPOSITORY_METHODS = Object.freeze([
  "findById",
  "findByChannelKey",
  "listByTenantId",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityChannelRepository(port) {
  return matchesPortMethods(port, COMMUNITY_CHANNEL_REPOSITORY_METHODS);
}

/**
 * @returns {CommunityChannelRepository}
 */
export function createUnimplementedCommunityChannelRepository() {
  return {
    async findById() {
      throwPortUnimplemented("CommunityChannelRepository", "findById");
    },
    async findByChannelKey() {
      throwPortUnimplemented("CommunityChannelRepository", "findByChannelKey");
    },
    async listByTenantId() {
      throwPortUnimplemented("CommunityChannelRepository", "listByTenantId");
    },
    async save() {
      throwPortUnimplemented("CommunityChannelRepository", "save");
    },
  };
}

/**
 * @typedef {Object} CommunityMessageRepository
 * @property {(messageId: string) => Promise<object|null>|object|null} findById
 * @property {(conversationId: string) => Promise<object[]>|object[]} listByConversationId
 * @property {(conversationId: string) => Promise<object|null>|object|null} findLatestByConversationId
 * @property {(conversationId: string, senderParticipantId: string) => Promise<object|null>|object|null} findLatestBySender
 * @property {(message: object) => Promise<object>|object} save
 * @property {(message: object) => Promise<object>|object} [update]
 */

export const COMMUNITY_MESSAGE_REPOSITORY_METHODS = Object.freeze([
  "findById",
  "listByConversationId",
  "findLatestByConversationId",
  "findLatestBySender",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityMessageRepository(port) {
  return matchesPortMethods(port, COMMUNITY_MESSAGE_REPOSITORY_METHODS);
}

/**
 * @returns {CommunityMessageRepository}
 */
export function createUnimplementedCommunityMessageRepository() {
  return {
    async findById() {
      throwPortUnimplemented("CommunityMessageRepository", "findById");
    },
    async listByConversationId() {
      throwPortUnimplemented(
        "CommunityMessageRepository",
        "listByConversationId"
      );
    },
    async findLatestByConversationId() {
      throwPortUnimplemented(
        "CommunityMessageRepository",
        "findLatestByConversationId"
      );
    },
    async findLatestBySender() {
      throwPortUnimplemented(
        "CommunityMessageRepository",
        "findLatestBySender"
      );
    },
    async save() {
      throwPortUnimplemented("CommunityMessageRepository", "save");
    },
  };
}

/**
 * @typedef {Object} CommunityReadCursorRepository
 * @property {(conversationId: string, participantId: string) => Promise<object|null>|object|null} find
 * @property {(cursor: object) => Promise<object>|object} save
 */

export const COMMUNITY_READ_CURSOR_REPOSITORY_METHODS = Object.freeze([
  "find",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityReadCursorRepository(port) {
  return matchesPortMethods(port, COMMUNITY_READ_CURSOR_REPOSITORY_METHODS);
}

/**
 * @returns {CommunityReadCursorRepository}
 */
export function createUnimplementedCommunityReadCursorRepository() {
  return {
    async find() {
      throwPortUnimplemented("CommunityReadCursorRepository", "find");
    },
    async save() {
      throwPortUnimplemented("CommunityReadCursorRepository", "save");
    },
  };
}

/**
 * @typedef {Object} CommunityPinnedMessageRepository
 * @property {(conversationId: string) => Promise<object[]>|object[]} listByConversationId
 * @property {(conversationId: string, messageId: string) => Promise<object|null>|object|null} find
 * @property {(pin: object) => Promise<object>|object} save
 * @property {(conversationId: string, messageId: string) => Promise<boolean>|boolean} remove
 */

export const COMMUNITY_PINNED_MESSAGE_REPOSITORY_METHODS = Object.freeze([
  "listByConversationId",
  "find",
  "save",
  "remove",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityPinnedMessageRepository(port) {
  return matchesPortMethods(port, COMMUNITY_PINNED_MESSAGE_REPOSITORY_METHODS);
}

/**
 * @returns {CommunityPinnedMessageRepository}
 */
export function createUnimplementedCommunityPinnedMessageRepository() {
  return {
    async listByConversationId() {
      throwPortUnimplemented(
        "CommunityPinnedMessageRepository",
        "listByConversationId"
      );
    },
    async find() {
      throwPortUnimplemented("CommunityPinnedMessageRepository", "find");
    },
    async save() {
      throwPortUnimplemented("CommunityPinnedMessageRepository", "save");
    },
    async remove() {
      throwPortUnimplemented("CommunityPinnedMessageRepository", "remove");
    },
  };
}
