/**
 * RatingCurrentStatePort — interface only (Phase 1B).
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} RatingCurrentStatePort
 * @property {(playerId: string, scope: unknown, ratingMode: string) => Promise<unknown|null>} getCurrentState
 * @property {(state: unknown) => Promise<unknown>} saveCurrentState
 */

export const RATING_CURRENT_STATE_PORT_METHODS = Object.freeze([
  "getCurrentState",
  "saveCurrentState",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRatingCurrentStatePort(port) {
  return matchesPortMethods(port, RATING_CURRENT_STATE_PORT_METHODS);
}

/**
 * @returns {RatingCurrentStatePort}
 */
export function createUnimplementedRatingCurrentStatePort() {
  return {
    async getCurrentState() {
      throwPortUnimplemented("RatingCurrentStatePort", "getCurrentState");
    },
    async saveCurrentState() {
      throwPortUnimplemented("RatingCurrentStatePort", "saveCurrentState");
    },
  };
}
