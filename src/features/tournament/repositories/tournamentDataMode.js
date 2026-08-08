/**
 * Canonical Tournament data-mode resolver.
 *
 * Default remains transitional_blob until Owner-authorized live SQL cutover.
 * Cloud mode fails closed when Supabase / RPCs are not ready.
 */

export const TOURNAMENT_DATA_MODES = Object.freeze({
  TRANSITIONAL_BLOB: "transitional_blob",
  CLOUD: "cloud",
});

function readEnv(name) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[name];
  }
  return globalThis.process?.env?.[name];
}

/**
 * @param {{ mode?: string }} [options]
 * @returns {"transitional_blob"|"cloud"}
 */
export function resolveTournamentDataMode(options = {}) {
  const explicit = String(options.mode || readEnv("VITE_TOURNAMENT_CANONICAL_DATA_MODE") || "")
    .trim()
    .toLowerCase();

  if (explicit === TOURNAMENT_DATA_MODES.CLOUD) {
    return TOURNAMENT_DATA_MODES.CLOUD;
  }
  if (explicit === TOURNAMENT_DATA_MODES.TRANSITIONAL_BLOB || !explicit) {
    return TOURNAMENT_DATA_MODES.TRANSITIONAL_BLOB;
  }

  throw new Error(
    `VITE_TOURNAMENT_CANONICAL_DATA_MODE không hợp lệ: "${explicit}". ` +
      `Cho phép: transitional_blob, cloud.`
  );
}

export function isTournamentCloudDataMode(options = {}) {
  return resolveTournamentDataMode(options) === TOURNAMENT_DATA_MODES.CLOUD;
}
