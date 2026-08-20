/**
 * Wave A1 strangler flag.
 * Default ON so Preview shows the new workspace.
 * Rollback: VITE_TOURNAMENT_EXPERIENCE_A1_ENABLED=false or ?experience=legacy
 */
export const TOURNAMENT_EXPERIENCE_A1_FLAG = "VITE_TOURNAMENT_EXPERIENCE_A1_ENABLED";
export const A1_LEGACY_EXPERIENCE_QUERY = "legacy";
export const A1_EXPERIENCE_QUERY_KEY = "experience";

function readEnv(env) {
  if (env && typeof env === "object") return env;
  const source = typeof import.meta !== "undefined" ? import.meta.env : {};
  return source || {};
}

export function isTournamentExperienceA1Enabled(env) {
  const raw = String(readEnv(env)[TOURNAMENT_EXPERIENCE_A1_FLAG] ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function isA1LegacyHubRequested(searchParams) {
  const value = String(searchParams?.get?.(A1_EXPERIENCE_QUERY_KEY) || "").trim().toLowerCase();
  return value === A1_LEGACY_EXPERIENCE_QUERY;
}
