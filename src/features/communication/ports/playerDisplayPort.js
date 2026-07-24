/**
 * PlayerDisplayPort — display-only player snapshots (COMMS-01).
 * Does not write Player Management SoT.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} PlayerDisplayPort
 * @property {(playerId: string) => Promise<object|null>} getDisplaySnapshot
 */

export const PLAYER_DISPLAY_PORT_METHODS = Object.freeze([
  "getDisplaySnapshot",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesPlayerDisplayPort(port) {
  return matchesPortMethods(port, PLAYER_DISPLAY_PORT_METHODS);
}

/**
 * @returns {PlayerDisplayPort}
 */
export function createUnimplementedPlayerDisplayPort() {
  return {
    async getDisplaySnapshot() {
      throwPortUnimplemented("PlayerDisplayPort", "getDisplaySnapshot");
    },
  };
}
