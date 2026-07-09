import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";

export const TEAM_TOURNAMENT_STORE_MODES = Object.freeze({
  MEMORY: "memory",
  LOCAL: "local",
  SUPABASE: "supabase",
});

function readEnvFlag(name) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[name];
  }
  return globalThis.process?.env?.[name];
}

export function resolveTeamTournamentStoreMode() {
  const forced = readEnvFlag("VITE_TEAM_TOURNAMENT_STORE_MODE");
  if (forced && Object.values(TEAM_TOURNAMENT_STORE_MODES).includes(forced)) {
    return forced;
  }

  if (readEnvFlag("NODE_ENV") === "test" || readEnvFlag("VITEST") === "true") {
    return TEAM_TOURNAMENT_STORE_MODES.MEMORY;
  }

  if (
    hasSupabaseConfig() &&
    String(readEnvFlag("VITE_TEAM_TOURNAMENT_SUPABASE") || "").toLowerCase() === "true"
  ) {
    return TEAM_TOURNAMENT_STORE_MODES.SUPABASE;
  }

  return TEAM_TOURNAMENT_STORE_MODES.LOCAL;
}

export function isTeamTournamentCloudEnabled() {
  return resolveTeamTournamentStoreMode() === TEAM_TOURNAMENT_STORE_MODES.SUPABASE;
}
