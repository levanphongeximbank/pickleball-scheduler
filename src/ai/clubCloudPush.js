import { syncClubToCloud } from "./cloudSync.js";
import { isClubCloudSyncEnabled } from "./cloudSyncConfig.js";
import { getClubCloudVersion } from "../domain/clubStorage.js";

const DEBOUNCE_MS = 1500;
const pendingTimers = new Map();

export function scheduleClubCloudPush(clubId) {
  const id = String(clubId || "").trim();
  if (!id || !isClubCloudSyncEnabled()) {
    return;
  }

  const existing = pendingTimers.get(id);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    pendingTimers.delete(id);
    void syncClubToCloud({
      clubId: id,
      expectedVersion: getClubCloudVersion(id),
    }).then((result) => {
      if (!result?.ok && result?.code !== "VERSION_CONFLICT") {
        console.warn("[clubCloudPush]", id, result?.error || result?.code);
      }
    });
  }, DEBOUNCE_MS);

  pendingTimers.set(id, timer);
}

export function flushClubCloudPushForTests() {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
}
