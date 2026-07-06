import { PERMISSIONS } from "../auth/permissions.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";
import { getClubCloudVersion } from "../domain/clubStorage.js";
import { pullClubFromCloud, syncClubToCloud } from "./cloudSync.js";

const SCHEDULE_SYNC_PERMISSION = PERMISSIONS.SCHEDULING_RUN;

/** Auto-push AI/club blob sau commit xếp sân khi bật flag + Supabase configured. */
export function isAiAutoCloudSyncEnabled() {
  if (!hasSupabaseConfig()) {
    return false;
  }
  return String(import.meta.env?.VITE_AI_AUTO_CLOUD_SYNC || "").toLowerCase() === "true";
}

export async function autoSyncAfterScheduleCommit(clubId) {
  if (!isAiAutoCloudSyncEnabled()) {
    return { ok: true, skipped: true };
  }

  try {
    const result = await syncClubToCloud({
      clubId,
      permission: SCHEDULE_SYNC_PERMISSION,
      expectedVersion: getClubCloudVersion(clubId),
    });
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Auto sync cloud thất bại.",
      code: "AUTO_SYNC_FAILED",
    };
  }
}

/** Pull club/AI blob khi đổi CLB — máy B thấy waiting/history mà không cần vào Cài đặt. */
export async function autoPullOnClubActivate(clubId) {
  if (!isAiAutoCloudSyncEnabled() || !clubId) {
    return { ok: true, skipped: true };
  }

  try {
    const result = await pullClubFromCloud({
      clubId,
      permission: SCHEDULE_SYNC_PERMISSION,
    });
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Auto pull cloud thất bại.",
      code: "AUTO_PULL_FAILED",
    };
  }
}
