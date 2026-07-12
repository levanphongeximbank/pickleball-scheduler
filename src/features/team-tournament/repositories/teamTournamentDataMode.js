import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";

/** @typedef {'legacy'|'shadow'|'cloud_primary'|'cloud_only'} TeamTournamentDataMode */

export const TEAM_TOURNAMENT_DATA_MODES = Object.freeze({
  LEGACY: "legacy",
  SHADOW: "shadow",
  CLOUD_PRIMARY: "cloud_primary",
  CLOUD_ONLY: "cloud_only",
});

const TT1B_ALLOWED = new Set([
  TEAM_TOURNAMENT_DATA_MODES.LEGACY,
  TEAM_TOURNAMENT_DATA_MODES.SHADOW,
]);

function readEnvFlag(name) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[name];
  }
  return globalThis.process?.env?.[name];
}

function mapLegacyFlagsToMode() {
  const storeMode = readEnvFlag("VITE_TEAM_TOURNAMENT_STORE_MODE");
  const supabaseFlag =
    String(readEnvFlag("VITE_TEAM_TOURNAMENT_SUPABASE") || "").toLowerCase() === "true";

  if (storeMode === "memory" || storeMode === "local") {
    return TEAM_TOURNAMENT_DATA_MODES.LEGACY;
  }

  if (supabaseFlag && hasSupabaseConfig()) {
    return TEAM_TOURNAMENT_DATA_MODES.SHADOW;
  }

  return TEAM_TOURNAMENT_DATA_MODES.LEGACY;
}

/**
 * Resolve data mode. TT-1B: only legacy | shadow allowed at runtime.
 * @param {{ allowFutureModes?: boolean }} [options]
 * @returns {TeamTournamentDataMode}
 */
export function resolveTeamTournamentDataMode(options = {}) {
  const explicit = String(readEnvFlag("VITE_TEAM_TOURNAMENT_DATA_MODE") || "").trim();

  let mode = explicit || mapLegacyFlagsToMode();

  if (!Object.values(TEAM_TOURNAMENT_DATA_MODES).includes(mode)) {
    throw new Error(
      `VITE_TEAM_TOURNAMENT_DATA_MODE không hợp lệ: "${mode}". ` +
        `Cho phép: legacy, shadow, cloud_primary, cloud_only.`
    );
  }

  if (
    !options.allowFutureModes &&
    !TT1B_ALLOWED.has(mode)
  ) {
    throw new Error(
      `TT-1B: mode "${mode}" chưa được bật. Chỉ legacy hoặc shadow. ` +
        `cloud_primary/cloud_only sẽ có ở TT-1C.`
    );
  }

  if (
    mode === TEAM_TOURNAMENT_DATA_MODES.SHADOW ||
    mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY ||
    mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY
  ) {
    if (!hasSupabaseConfig()) {
      throw new Error(
        "Team tournament cloud mode yêu cầu VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY."
      );
    }
    if (String(readEnvFlag("VITE_TEAM_TOURNAMENT_SUPABASE") || "").toLowerCase() !== "true") {
      throw new Error(
        "Team tournament cloud mode yêu cầu VITE_TEAM_TOURNAMENT_SUPABASE=true."
      );
    }
  }

  const storeMode = readEnvFlag("VITE_TEAM_TOURNAMENT_STORE_MODE");
  const blobOnlyStoreModes = new Set(["local", "memory"]);
  if (
    blobOnlyStoreModes.has(storeMode) &&
    mode !== TEAM_TOURNAMENT_DATA_MODES.LEGACY
  ) {
    throw new Error(
      `Cấu hình mâu thuẫn: VITE_TEAM_TOURNAMENT_STORE_MODE=${storeMode} nhưng DATA_MODE="${mode}" yêu cầu cloud.`
    );
  }

  return mode;
}

export function isTeamTournamentShadowMode() {
  return resolveTeamTournamentDataMode() === TEAM_TOURNAMENT_DATA_MODES.SHADOW;
}
