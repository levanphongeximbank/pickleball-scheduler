/**
 * RatingHistoryPort — append-only history interface (Phase 1B).
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} RatingHistoryPort
 * @property {(entry: unknown) => Promise<unknown>} appendHistoryEntry
 * @property {(playerId: string, scope: unknown, options?: object) => Promise<unknown[]>} listHistory
 */

export const RATING_HISTORY_PORT_METHODS = Object.freeze([
  "appendHistoryEntry",
  "listHistory",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRatingHistoryPort(port) {
  return matchesPortMethods(port, RATING_HISTORY_PORT_METHODS);
}

/**
 * @returns {RatingHistoryPort}
 */
export function createUnimplementedRatingHistoryPort() {
  return {
    async appendHistoryEntry() {
      throwPortUnimplemented("RatingHistoryPort", "appendHistoryEntry");
    },
    async listHistory() {
      throwPortUnimplemented("RatingHistoryPort", "listHistory");
    },
  };
}
