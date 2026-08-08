import { resolveTournamentDataMode, TOURNAMENT_DATA_MODES } from "./tournamentDataMode.js";
import { createTransitionalBlobTournamentRepository } from "./transitionalBlobTournamentRepository.js";
import { createCloudTournamentRepository } from "./cloudTournamentRepository.js";

/**
 * @param {{ mode?: string }} [options]
 */
export function createTournamentRepository(options = {}) {
  const mode = resolveTournamentDataMode(options);
  if (mode === TOURNAMENT_DATA_MODES.CLOUD) {
    return createCloudTournamentRepository();
  }
  return createTransitionalBlobTournamentRepository();
}

let singleton = null;

export function getTournamentRepository(options = {}) {
  if (options.mode || options.fresh) {
    return createTournamentRepository(options);
  }
  if (!singleton) {
    singleton = createTournamentRepository();
  }
  return singleton;
}

/** @internal test helper */
export function __resetTournamentRepositorySingleton() {
  singleton = null;
}
