/**
 * DirectConversationRepository port (COMMS-02).
 * Persistence-agnostic. No Supabase / SQL wiring in this phase.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} DirectConversationAggregate
 * @property {object} conversation
 * @property {readonly object[]} participants
 * @property {string} pairKey
 */

/**
 * @typedef {Object} DirectConversationRepository
 * @property {(conversationId: string) => Promise<object|null>|object|null} findById
 * @property {(pairKey: string) => Promise<object|null>|object|null} findByPairKey
 * @property {(participantId: string) => Promise<object[]>|object[]} listByParticipantId
 * @property {(aggregate: DirectConversationAggregate) => Promise<object>|object} save
 */

export const DIRECT_CONVERSATION_REPOSITORY_METHODS = Object.freeze([
  "findById",
  "findByPairKey",
  "listByParticipantId",
  "save",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesDirectConversationRepository(port) {
  return matchesPortMethods(port, DIRECT_CONVERSATION_REPOSITORY_METHODS);
}

/**
 * @returns {DirectConversationRepository}
 */
export function createUnimplementedDirectConversationRepository() {
  return {
    async findById() {
      throwPortUnimplemented("DirectConversationRepository", "findById");
    },
    async findByPairKey() {
      throwPortUnimplemented("DirectConversationRepository", "findByPairKey");
    },
    async listByParticipantId() {
      throwPortUnimplemented(
        "DirectConversationRepository",
        "listByParticipantId"
      );
    },
    async save() {
      throwPortUnimplemented("DirectConversationRepository", "save");
    },
  };
}
