/**
 * Player Rating Foundation — Phase 1D append-only history & immutable snapshots.
 * In-memory adapters are foundation/test only — not Production persistence.
 */

export {
  timestampSortValue,
  compareHistoryEntriesAscending,
  compareSnapshotsAscending,
  sortDeterministically,
} from "./ordering.js";

export { scopesMatch, requireQueryScope } from "./scopeMatch.js";

export {
  buildStoredHistoryEntry,
  appendRatingHistory,
  getRatingHistoryByEventId,
  listRatingHistory,
  rejectHistoryMutation,
} from "./appendRatingHistory.js";

export {
  buildStoredSnapshot,
  createRatingSnapshot,
  getRatingSnapshotById,
  listRatingSnapshots,
  rejectSnapshotMutation,
} from "./createRatingSnapshot.js";

export { createInMemoryRatingHistoryAdapter } from "./createInMemoryRatingHistoryAdapter.js";
export { createInMemoryRatingSnapshotAdapter } from "./createInMemoryRatingSnapshotAdapter.js";

export const PLAYER_RATING_HISTORY_SNAPSHOT_PHASE = Object.freeze({
  id: "1D",
  name: "append-only-history-and-immutable-snapshots",
  wiredToProductionRuntime: false,
  isProductionPersistence: false,
  convertsScales: false,
  selectsRuntimeSsot: false,
  mutatesCurrentRating: false,
  generatesIdsOrTimestamps: false,
});
