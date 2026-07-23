/**
 * In-memory RatingSnapshotPort adapter (foundation/test only — not Production persistence).
 */

import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import { failContract } from "../contracts/shared.js";
import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { matchesRatingSnapshotPort } from "../ports/ratingSnapshotPort.js";
import {
  createRatingSnapshot,
  getRatingSnapshotById,
  listRatingSnapshots,
  rejectSnapshotMutation,
} from "./createRatingSnapshot.js";
import { scopesMatch } from "./scopeMatch.js";

/**
 * @returns {import('../ports/ratingSnapshotPort.js').RatingSnapshotPort & {
 *   listSnapshots: (playerId: string, scope: unknown, options?: object) => Promise<unknown[]>,
 *   updateSnapshot: () => Promise<never>,
 *   deleteSnapshot: () => Promise<never>,
 * }}
 */
export function createInMemoryRatingSnapshotAdapter() {
  /** @type {{ bySnapshotId: Map<string, import('./createRatingSnapshot.js').StoredRatingSnapshot> }} */
  const store = { bySnapshotId: new Map() };

  const adapter = {
    async createSnapshot(snapshot) {
      return createRatingSnapshot(store, snapshot);
    },
    async getSnapshot(snapshotId, scope) {
      const found = getRatingSnapshotById(store, snapshotId);
      if (scope != null) {
        const queryScope = requireExplicitPlayerRatingScope(scope);
        if (!scopesMatch(found.scope, queryScope)) {
          failContract(
            PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_NOT_FOUND,
            `Snapshot not found in requested scope: ${snapshotId}`,
            { snapshotId }
          );
        }
      }
      return found;
    },
    async listSnapshots(playerId, scope, options) {
      return listRatingSnapshots(store, playerId, scope, options);
    },
    async updateSnapshot() {
      rejectSnapshotMutation("update");
    },
    async deleteSnapshot() {
      rejectSnapshotMutation("delete");
    },
  };

  if (!matchesRatingSnapshotPort(adapter)) {
    throw new Error(
      "In-memory snapshot adapter does not match RatingSnapshotPort"
    );
  }

  return adapter;
}
