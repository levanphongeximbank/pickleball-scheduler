import { hasSupabaseConfig } from "../auth/supabaseClient.js";
import { isCourtEngineCloudEnabled } from "../features/court-engine/storage/courtEngineCloudStore.js";

/** Phase 22 — club blob auto pull/push khi bật SaaS cloud persistence. */
export function isClubCloudSyncEnabled() {
  if (!hasSupabaseConfig()) {
    return false;
  }

  const explicit = String(import.meta.env?.VITE_CLUB_CLOUD_SYNC || "").toLowerCase();
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }

  if (String(import.meta.env?.VITE_AI_AUTO_CLOUD_SYNC || "").toLowerCase() === "true") {
    return true;
  }

  return isCourtEngineCloudEnabled();
}

/** @deprecated alias — dùng isClubCloudSyncEnabled */
export function isAiAutoCloudSyncEnabled() {
  return isClubCloudSyncEnabled();
}
