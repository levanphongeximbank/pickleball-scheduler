/**
 * Phase 45A.3E — gate for retired Club entity blob / dual-write authority.
 *
 * When Club Storage V2 is ON and Supabase is configured, public.clubs via
 * club_create / club_update is the only Club entity write plane. Legacy writers
 * may run only as offline / V2-OFF / no-Supabase rollback adapters.
 */
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";

/** True when Production cloud Club storage owns Club entity create/update. */
export function isClubCloudCommandAuthoritative() {
  return Boolean(isClubStorageV2Enabled() && hasSupabaseConfig());
}

/**
 * @param {{ operation: string, deferred?: boolean }} options
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertLegacyClubEntityWriteAllowed({
  operation,
  deferred = false,
} = {}) {
  if (!isClubCloudCommandAuthoritative()) {
    return { ok: true };
  }

  const label = String(operation || "legacy Club write").trim();
  if (deferred) {
    return {
      ok: false,
      code: API_ERROR_CODES.FEATURE_DISABLED,
      error: `${label} bị khóa khi Club Storage V2 bật (chờ phase archive/delete / governance commands).`,
    };
  }

  return {
    ok: false,
    code: API_ERROR_CODES.FEATURE_DISABLED,
    error: `${label} đã nghỉ hưu khi Club Storage V2 bật. Dùng clubTenantService → club_create/club_update.`,
  };
}
