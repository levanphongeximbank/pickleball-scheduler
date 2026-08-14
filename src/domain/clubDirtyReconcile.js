/**
 * Reconcile stale club dirty metadata against a canonical club_data_v3 snapshot.
 * Does not last-write-wins. Does not write to cloud.
 */
import { loadClubData } from "./clubStorage.js";
import {
  isClubDataDirty,
  markClubDataSynced,
  getClubDirtyProvenance,
} from "./clubSyncMetadata.js";
import { diffClubBlobSemantic } from "./clubBlobSemanticDiff.js";

export function reconcileStaleClubDirtyWithSnapshot(clubId, snapshotClubData) {
  if (!clubId || !snapshotClubData || typeof snapshotClubData !== "object") {
    return { ok: false, stale: false, paths: [] };
  }
  if (!isClubDataDirty(clubId)) {
    return { ok: true, stale: false, paths: [], provenance: getClubDirtyProvenance(clubId) };
  }
  const local = loadClubData(clubId);
  const paths = diffClubBlobSemantic(local, snapshotClubData);
  if (paths.length > 0) {
    return {
      ok: false,
      stale: false,
      paths,
      provenance: getClubDirtyProvenance(clubId),
    };
  }
  markClubDataSynced(clubId, { pull: true });
  return {
    ok: true,
    stale: true,
    paths: [],
    provenance: getClubDirtyProvenance(clubId),
  };
}
