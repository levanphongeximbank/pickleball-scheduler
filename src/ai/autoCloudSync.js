import { PERMISSIONS } from "../auth/permissions.js";
import { getClubCloudVersion } from "../domain/clubStorage.js";
import { pullClubFromCloud, syncClubToCloud } from "./cloudSync.js";
import { isClubCloudSyncEnabled } from "./cloudSyncConfig.js";

export { isClubCloudSyncEnabled, isAiAutoCloudSyncEnabled } from "./cloudSyncConfig.js";

const SCHEDULE_SYNC_PERMISSION = PERMISSIONS.SCHEDULING_RUN;

export async function autoSyncAfterScheduleCommit(clubId) {
  if (!isClubCloudSyncEnabled()) {
    return { ok: true, skipped: true };
  }

  try {
    return await syncClubToCloud({
      clubId,
      permission: SCHEDULE_SYNC_PERMISSION,
      expectedVersion: getClubCloudVersion(clubId),
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Auto sync cloud thất bại.",
      code: "AUTO_SYNC_FAILED",
    };
  }
}

export async function autoPullOnClubActivate(clubId) {
  if (!isClubCloudSyncEnabled() || !clubId) {
    return { ok: true, skipped: true };
  }

  try {
    return await pullClubFromCloud({
      clubId,
      permission: SCHEDULE_SYNC_PERMISSION,
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Auto pull cloud thất bại.",
      code: "AUTO_PULL_FAILED",
    };
  }
}
