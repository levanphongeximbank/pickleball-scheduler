import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";

/**
 * Phase 42F — Club Storage V2 (Cloud SSOT).
 * Chỉ bật khi VITE_CLUB_STORAGE_V2=true.
 * Production giữ false cho đến GO PRODUCTION RESET + schema V2 trên prod.
 */
export function isClubStorageV2Enabled() {
  if (!hasSupabaseConfig()) {
    return false;
  }
  return String(import.meta.env?.VITE_CLUB_STORAGE_V2 || "").toLowerCase() === "true";
}

/** Club registry (danh sách CLB) sync với Supabase club_governance (legacy V1). */
export function isClubRegistryCloudEnabled() {
  if (isClubStorageV2Enabled()) {
    // V2: không dùng legacy registry push/pull như SoT
    return false;
  }

  if (!hasSupabaseConfig()) {
    return false;
  }

  const explicit = String(import.meta.env?.VITE_CLUB_REGISTRY_CLOUD || "").toLowerCase();
  if (explicit === "false") {
    return false;
  }
  if (explicit === "true") {
    return true;
  }

  return true;
}

/** Cloud `club_governance` là SSOT; local `pickleball-clubs-v1` là cache sau pull/merge. */
export function isClubRegistryCloudAuthoritative() {
  if (isClubStorageV2Enabled()) {
    return true;
  }
  return isClubRegistryCloudEnabled();
}
