import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";

function readViteFlag(name) {
  const fromMeta =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env[name]
      : undefined;
  const fromProcess =
    typeof globalThis.process !== "undefined" ? globalThis.process.env?.[name] : undefined;
  return String(fromMeta || fromProcess || "").toLowerCase();
}

/**
 * Phase 42F — Club Storage V2 (Cloud SSOT).
 * Chỉ bật khi VITE_CLUB_STORAGE_V2=true.
 * Production giữ false cho đến GO PRODUCTION RESET + schema V2 trên prod.
 */
export function isClubStorageV2Enabled() {
  if (!hasSupabaseConfig()) {
    return false;
  }
  return readViteFlag("VITE_CLUB_STORAGE_V2") === "true";
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

  const explicit = readViteFlag("VITE_CLUB_REGISTRY_CLOUD");
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
