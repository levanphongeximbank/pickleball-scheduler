/**
 * DirectConversationRequestRepository port (COMMS-02).
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} DirectConversationRequestRepository
 * @property {(requestId: string) => Promise<object|null>|object|null} findById
 * @property {(pairKey: string) => Promise<object|null>|object|null} findPendingByPairKey
 * @property {(request: object) => Promise<object>|object} save
 * @property {(request: object) => Promise<object>|object} update
 */

export const DIRECT_CONVERSATION_REQUEST_REPOSITORY_METHODS = Object.freeze([
  "findById",
  "findPendingByPairKey",
  "save",
  "update",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesDirectConversationRequestRepository(port) {
  return matchesPortMethods(
    port,
    DIRECT_CONVERSATION_REQUEST_REPOSITORY_METHODS
  );
}

/**
 * @returns {DirectConversationRequestRepository}
 */
export function createUnimplementedDirectConversationRequestRepository() {
  return {
    async findById() {
      throwPortUnimplemented(
        "DirectConversationRequestRepository",
        "findById"
      );
    },
    async findPendingByPairKey() {
      throwPortUnimplemented(
        "DirectConversationRequestRepository",
        "findPendingByPairKey"
      );
    },
    async save() {
      throwPortUnimplemented("DirectConversationRequestRepository", "save");
    },
    async update() {
      throwPortUnimplemented("DirectConversationRequestRepository", "update");
    },
  };
}
