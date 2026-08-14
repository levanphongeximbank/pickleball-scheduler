/**
 * Reconcile stale club dirty metadata against a canonical club_data_v3 snapshot.
 * Does not last-write-wins. Does not write to cloud.
 * Representation/default/legacy mismatches are not pending mutations.
 */
import { loadClubData } from "./clubStorage.js";
import {
  isClubDataDirty,
  markClubDataSynced,
  getClubDirtyProvenance,
} from "./clubSyncMetadata.js";
import { inspectClubBlobSemanticDiff } from "./clubBlobSemanticDiff.js";

export function reconcileStaleClubDirtyWithSnapshot(clubId, snapshotClubData) {
  if (!clubId || !snapshotClubData || typeof snapshotClubData !== "object") {
    return { ok: false, stale: false, paths: [] };
  }
  if (!isClubDataDirty(clubId)) {
    return { ok: true, stale: false, paths: [], provenance: getClubDirtyProvenance(clubId) };
  }
  const local = loadClubData(clubId);
  const inspected = inspectClubBlobSemanticDiff(local, snapshotClubData);
  const provenance = getClubDirtyProvenance(clubId);
  if (inspected.realPendingPaths.length > 0) {
    return {
      ok: false,
      stale: false,
      paths: inspected.realPendingPaths,
      representationPaths: inspected.representationPaths,
      rawUnequalPaths: inspected.rawUnequalPaths,
      details: inspected.details,
      provenance,
    };
  }
  markClubDataSynced(clubId, { pull: true });
  return {
    ok: true,
    stale: true,
    paths: [],
    representationPaths: inspected.representationPaths,
    rawUnequalPaths: inspected.rawUnequalPaths,
    details: inspected.details,
    provenance: getClubDirtyProvenance(clubId),
  };
}
