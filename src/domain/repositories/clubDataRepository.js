import {
  getClubCloudVersion,
  loadClubData,
  saveClubData,
} from "../clubStorage.js";
import {
  getClubSyncMeta,
  isClubDataDirty,
  markClubDataSynced,
} from "../clubSyncMetadata.js";
import {
  pullClubFromCloud,
  readRemoteClubCloudVersion,
  syncClubToCloud,
} from "../../ai/cloudSync.js";
import { isClubCloudSyncEnabled } from "../../ai/cloudSyncConfig.js";

export function createLocalClubDataRepository() {
  return {
    mode: "local",
    load(clubId) {
      return loadClubData(clubId);
    },
    save(clubId, data) {
      return saveClubData(clubId, data);
    },
    getSyncMeta(clubId) {
      return getClubSyncMeta(clubId);
    },
    isDirty(clubId) {
      return isClubDataDirty(clubId);
    },
    getLocalVersion(clubId) {
      return getClubCloudVersion(clubId);
    },
    async pull(clubId, options = {}) {
      return pullClubFromCloud({ clubId, ...options });
    },
    async push(clubId, options = {}) {
      return syncClubToCloud({
        clubId,
        expectedVersion: options.expectedVersion ?? getClubCloudVersion(clubId),
        ...options,
      });
    },
    async shouldAutoPull(clubId) {
      if (!clubId) {
        return { shouldPull: false, reason: "NO_CLUB" };
      }

      if (isClubDataDirty(clubId)) {
        return { shouldPull: false, reason: "LOCAL_DIRTY" };
      }

      if (!isClubCloudSyncEnabled()) {
        return { shouldPull: false, reason: "CLOUD_DISABLED" };
      }

      const remote = await readRemoteClubCloudVersion(clubId);
      if (!remote.ok) {
        return { shouldPull: false, reason: "REMOTE_UNAVAILABLE" };
      }

      const localVersion = getClubCloudVersion(clubId);
      if (remote.version <= localVersion) {
        return { shouldPull: false, reason: "UP_TO_DATE", localVersion, remoteVersion: remote.version };
      }

      return {
        shouldPull: true,
        reason: "REMOTE_NEWER",
        localVersion,
        remoteVersion: remote.version,
      };
    },
    markSynced(clubId, options = {}) {
      markClubDataSynced(clubId, options);
    },
  };
}

export function createClubDataRepository() {
  return createLocalClubDataRepository();
}
