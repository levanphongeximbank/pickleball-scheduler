/**
 * CommunityRestrictionRepository — Communication-owned ban/suspend evidence (COMMS-04).
 * Persistence-agnostic; not Platform Core membership SoT.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} CommunityRestrictionRepository
 * @property {(tenantId: string, participantId: string, channelKey?: string|null) => Promise<object|null>|object|null} find
 * @property {(restriction: object) => Promise<object>|object} save
 * @property {(tenantId: string, participantId: string, channelKey?: string|null) => Promise<boolean>|boolean} clear
 */

export const COMMUNITY_RESTRICTION_REPOSITORY_METHODS = Object.freeze([
  "find",
  "save",
  "clear",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityRestrictionRepository(port) {
  return matchesPortMethods(port, COMMUNITY_RESTRICTION_REPOSITORY_METHODS);
}

/**
 * @returns {CommunityRestrictionRepository}
 */
export function createUnimplementedCommunityRestrictionRepository() {
  return {
    async find() {
      throwPortUnimplemented("CommunityRestrictionRepository", "find");
    },
    async save() {
      throwPortUnimplemented("CommunityRestrictionRepository", "save");
    },
    async clear() {
      throwPortUnimplemented("CommunityRestrictionRepository", "clear");
    },
  };
}

/**
 * Optional report store port for community reports (in-memory for tests).
 * @typedef {Object} CommunityReportRepository
 * @property {(report: object) => Promise<object>|object} save
 * @property {(reportId: string) => Promise<object|null>|object|null} findById
 */

export const COMMUNITY_REPORT_REPOSITORY_METHODS = Object.freeze([
  "save",
  "findById",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityReportRepository(port) {
  return matchesPortMethods(port, COMMUNITY_REPORT_REPOSITORY_METHODS);
}

/**
 * @returns {CommunityReportRepository}
 */
export function createUnimplementedCommunityReportRepository() {
  return {
    async save() {
      throwPortUnimplemented("CommunityReportRepository", "save");
    },
    async findById() {
      throwPortUnimplemented("CommunityReportRepository", "findById");
    },
  };
}

/**
 * Optional moderation action evidence store (not production audit SoT).
 * @typedef {Object} CommunityModerationActionRepository
 * @property {(action: object) => Promise<object>|object} save
 * @property {(conversationId: string) => Promise<object[]>|object[]} listByConversationId
 */

export const COMMUNITY_MODERATION_ACTION_REPOSITORY_METHODS = Object.freeze([
  "save",
  "listByConversationId",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityModerationActionRepository(port) {
  return matchesPortMethods(
    port,
    COMMUNITY_MODERATION_ACTION_REPOSITORY_METHODS
  );
}

/**
 * @returns {CommunityModerationActionRepository}
 */
export function createUnimplementedCommunityModerationActionRepository() {
  return {
    async save() {
      throwPortUnimplemented(
        "CommunityModerationActionRepository",
        "save"
      );
    },
    async listByConversationId() {
      throwPortUnimplemented(
        "CommunityModerationActionRepository",
        "listByConversationId"
      );
    },
  };
}
