/**
 * Club channel / message / read-cursor / pinned-message repository ports (COMMS-03).
 * Persistence-agnostic. No Supabase / SQL wiring in this phase.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} ClubChannelAggregate
 * @property {object} conversation
 * @property {readonly object[]} participants
 * @property {string} clubId
 * @property {string} channelKind
 * @property {string} channelKey
 * @property {string|null} name
 */

/**
 * @typedef {Object} ClubChannelRepository
 * @property {(conversationId: string) => Promise<object|null>|object|null} findById
 * @property {(channelKey: string) => Promise<object|null>|object|null} findByChannelKey
 * @property {(clubId: string) => Promise<object[]>|object[]} listByClubId
 * @property {(aggregate: ClubChannelAggregate) => Promise<object>|object} save
 */

export const CLUB_CHANNEL_REPOSITORY_METHODS = Object.freeze([
  "findById",
  "findByChannelKey",
  "listByClubId",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClubChannelRepository(port) {
  return matchesPortMethods(port, CLUB_CHANNEL_REPOSITORY_METHODS);
}

/**
 * @returns {ClubChannelRepository}
 */
export function createUnimplementedClubChannelRepository() {
  return {
    async findById() {
      throwPortUnimplemented("ClubChannelRepository", "findById");
    },
    async findByChannelKey() {
      throwPortUnimplemented("ClubChannelRepository", "findByChannelKey");
    },
    async listByClubId() {
      throwPortUnimplemented("ClubChannelRepository", "listByClubId");
    },
    async save() {
      throwPortUnimplemented("ClubChannelRepository", "save");
    },
  };
}

/**
 * @typedef {Object} ClubMessageRepository
 * @property {(messageId: string) => Promise<object|null>|object|null} findById
 * @property {(conversationId: string) => Promise<object[]>|object[]} listByConversationId
 * @property {(conversationId: string) => Promise<object|null>|object|null} findLatestByConversationId
 * @property {(message: object) => Promise<object>|object} save
 */

export const CLUB_MESSAGE_REPOSITORY_METHODS = Object.freeze([
  "findById",
  "listByConversationId",
  "findLatestByConversationId",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClubMessageRepository(port) {
  return matchesPortMethods(port, CLUB_MESSAGE_REPOSITORY_METHODS);
}

/**
 * @returns {ClubMessageRepository}
 */
export function createUnimplementedClubMessageRepository() {
  return {
    async findById() {
      throwPortUnimplemented("ClubMessageRepository", "findById");
    },
    async listByConversationId() {
      throwPortUnimplemented("ClubMessageRepository", "listByConversationId");
    },
    async findLatestByConversationId() {
      throwPortUnimplemented(
        "ClubMessageRepository",
        "findLatestByConversationId"
      );
    },
    async save() {
      throwPortUnimplemented("ClubMessageRepository", "save");
    },
  };
}

/**
 * @typedef {Object} ClubReadCursorRepository
 * @property {(conversationId: string, participantId: string) => Promise<object|null>|object|null} find
 * @property {(cursor: object) => Promise<object>|object} save
 */

export const CLUB_READ_CURSOR_REPOSITORY_METHODS = Object.freeze([
  "find",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClubReadCursorRepository(port) {
  return matchesPortMethods(port, CLUB_READ_CURSOR_REPOSITORY_METHODS);
}

/**
 * @returns {ClubReadCursorRepository}
 */
export function createUnimplementedClubReadCursorRepository() {
  return {
    async find() {
      throwPortUnimplemented("ClubReadCursorRepository", "find");
    },
    async save() {
      throwPortUnimplemented("ClubReadCursorRepository", "save");
    },
  };
}

/**
 * @typedef {Object} ClubPinnedMessageRepository
 * @property {(conversationId: string) => Promise<object[]>|object[]} listByConversationId
 * @property {(conversationId: string, messageId: string) => Promise<object|null>|object|null} find
 * @property {(pin: object) => Promise<object>|object} save
 * @property {(conversationId: string, messageId: string) => Promise<boolean>|boolean} remove
 */

export const CLUB_PINNED_MESSAGE_REPOSITORY_METHODS = Object.freeze([
  "listByConversationId",
  "find",
  "save",
  "remove",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClubPinnedMessageRepository(port) {
  return matchesPortMethods(port, CLUB_PINNED_MESSAGE_REPOSITORY_METHODS);
}

/**
 * @returns {ClubPinnedMessageRepository}
 */
export function createUnimplementedClubPinnedMessageRepository() {
  return {
    async listByConversationId() {
      throwPortUnimplemented(
        "ClubPinnedMessageRepository",
        "listByConversationId"
      );
    },
    async find() {
      throwPortUnimplemented("ClubPinnedMessageRepository", "find");
    },
    async save() {
      throwPortUnimplemented("ClubPinnedMessageRepository", "save");
    },
    async remove() {
      throwPortUnimplemented("ClubPinnedMessageRepository", "remove");
    },
  };
}
