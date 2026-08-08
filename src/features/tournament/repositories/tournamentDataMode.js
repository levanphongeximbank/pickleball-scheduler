/**
 * Canonical Tournament data mode — CLOUD ONLY (hard cutover).
 * No transitional_blob / localStorage authority in the active path.
 */

export const TOURNAMENT_DATA_MODES = Object.freeze({
  CLOUD: "cloud",
});

/**
 * @returns {"cloud"}
 */
export function resolveTournamentDataMode() {
  return TOURNAMENT_DATA_MODES.CLOUD;
}

export function isTournamentCloudDataMode() {
  return true;
}
