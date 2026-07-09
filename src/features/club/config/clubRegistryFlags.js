import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";

/** Club registry (danh sách CLB) sync với Supabase club_governance. */
export function isClubRegistryCloudEnabled() {
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

  // Mặc định bật khi đã cấu hình Supabase (production/staging).
  return true;
}

/** Cloud `club_governance` là SSOT; local `pickleball-clubs-v1` là cache sau pull/merge. */
export function isClubRegistryCloudAuthoritative() {
  return isClubRegistryCloudEnabled();
}
