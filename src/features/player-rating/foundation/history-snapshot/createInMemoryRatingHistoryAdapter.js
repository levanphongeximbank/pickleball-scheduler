/**
 * In-memory RatingHistoryPort adapter (foundation/test only — not Production persistence).
 */

import {
  appendRatingHistory,
  getRatingHistoryByEventId,
  listRatingHistory,
  rejectHistoryMutation,
} from "./appendRatingHistory.js";
import { matchesRatingHistoryPort } from "../ports/ratingHistoryPort.js";

/**
 * @returns {import('../ports/ratingHistoryPort.js').RatingHistoryPort & {
 *   getHistoryEntry: (eventId: string) => Promise<unknown>,
 *   updateHistoryEntry: () => Promise<never>,
 *   deleteHistoryEntry: () => Promise<never>,
 * }}
 */
export function createInMemoryRatingHistoryAdapter() {
  /** @type {{ byEventId: Map<string, import('./appendRatingHistory.js').StoredRatingHistoryEntry> }} */
  const store = { byEventId: new Map() };

  const adapter = {
    async appendHistoryEntry(entry) {
      return appendRatingHistory(store, entry);
    },
    async listHistory(playerId, scope, options) {
      return listRatingHistory(store, playerId, scope, options);
    },
    async getHistoryEntry(eventId) {
      return getRatingHistoryByEventId(store, eventId);
    },
    async updateHistoryEntry() {
      rejectHistoryMutation("update");
    },
    async deleteHistoryEntry() {
      rejectHistoryMutation("delete");
    },
  };

  if (!matchesRatingHistoryPort(adapter)) {
    throw new Error("In-memory history adapter does not match RatingHistoryPort");
  }

  return adapter;
}
