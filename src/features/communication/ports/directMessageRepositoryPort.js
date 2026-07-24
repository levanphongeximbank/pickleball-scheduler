/**
 * DirectMessageRepository + ReadCursor reader/writer ports (COMMS-02).
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} DirectMessageRepository
 * @property {(messageId: string) => Promise<object|null>|object|null} findById
 * @property {(conversationId: string) => Promise<object[]>|object[]} listByConversationId
 * @property {(conversationId: string) => Promise<object|null>|object|null} findLatestByConversationId
 * @property {(message: object) => Promise<object>|object} save
 */

export const DIRECT_MESSAGE_REPOSITORY_METHODS = Object.freeze([
  "findById",
  "listByConversationId",
  "findLatestByConversationId",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesDirectMessageRepository(port) {
  return matchesPortMethods(port, DIRECT_MESSAGE_REPOSITORY_METHODS);
}

/**
 * @returns {DirectMessageRepository}
 */
export function createUnimplementedDirectMessageRepository() {
  return {
    async findById() {
      throwPortUnimplemented("DirectMessageRepository", "findById");
    },
    async listByConversationId() {
      throwPortUnimplemented("DirectMessageRepository", "listByConversationId");
    },
    async findLatestByConversationId() {
      throwPortUnimplemented(
        "DirectMessageRepository",
        "findLatestByConversationId"
      );
    },
    async save() {
      throwPortUnimplemented("DirectMessageRepository", "save");
    },
  };
}

/**
 * @typedef {Object} DirectReadCursorRepository
 * @property {(conversationId: string, participantId: string) => Promise<object|null>|object|null} find
 * @property {(cursor: object) => Promise<object>|object} save
 */

export const DIRECT_READ_CURSOR_REPOSITORY_METHODS = Object.freeze([
  "find",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesDirectReadCursorRepository(port) {
  return matchesPortMethods(port, DIRECT_READ_CURSOR_REPOSITORY_METHODS);
}

/**
 * @returns {DirectReadCursorRepository}
 */
export function createUnimplementedDirectReadCursorRepository() {
  return {
    async find() {
      throwPortUnimplemented("DirectReadCursorRepository", "find");
    },
    async save() {
      throwPortUnimplemented("DirectReadCursorRepository", "save");
    },
  };
}
