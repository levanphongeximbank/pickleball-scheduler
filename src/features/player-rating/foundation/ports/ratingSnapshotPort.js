/**
 * RatingSnapshotPort — immutable snapshot interface (Phase 1B).
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";
import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} RatingSnapshotPort
 * @property {(snapshot: unknown) => Promise<unknown>} createSnapshot
 * @property {(snapshotId: string, scope: unknown) => Promise<unknown|null>} getSnapshot
 */

export const RATING_SNAPSHOT_PORT_METHODS = Object.freeze([
  "createSnapshot",
  "getSnapshot",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRatingSnapshotPort(port) {
  return matchesPortMethods(port, RATING_SNAPSHOT_PORT_METHODS);
}

/**
 * @returns {RatingSnapshotPort}
 */
export function createUnimplementedRatingSnapshotPort() {
  return {
    async createSnapshot() {
      throwPortUnimplemented("RatingSnapshotPort", "createSnapshot");
    },
    async getSnapshot(snapshotId) {
      throw new PlayerRatingFoundationError(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_NOT_FOUND,
        "Snapshot not found: RatingSnapshotPort is unimplemented",
        { snapshotId }
      );
    },
  };
}
