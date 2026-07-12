import {
  resolveTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "./teamTournamentDataMode.js";
import { createBlobTeamTournamentRepository } from "./blobTeamTournamentRepository.js";
import { createCloudTeamTournamentRepository } from "./cloudTeamTournamentRepository.js";
import { createShadowTeamTournamentRepository } from "./shadowTeamTournamentRepository.js";

let testModeOverride = null;

export function __setTeamTournamentDataModeForTests(mode) {
  testModeOverride = mode;
}

export function __resetTeamTournamentDataModeForTests() {
  testModeOverride = null;
}

export function resolveActiveTeamTournamentDataMode(options = {}) {
  if (testModeOverride) {
    if (!Object.values(TEAM_TOURNAMENT_DATA_MODES).includes(testModeOverride)) {
      throw new Error(
        `VITE_TEAM_TOURNAMENT_DATA_MODE không hợp lệ: "${testModeOverride}".`
      );
    }
    if (!options.allowFutureModes && !["legacy", "shadow"].includes(testModeOverride)) {
      throw new Error(`TT-1B test override mode not allowed: ${testModeOverride}`);
    }
    return testModeOverride;
  }
  return resolveTeamTournamentDataMode(options);
}

/** TT-1C UI entry — enables cloud_primary / cloud_only when env allows. */
export function resolveUiTeamTournamentDataMode(options = {}) {
  return resolveActiveTeamTournamentDataMode({ ...options, allowFutureModes: true });
}

/**
 * Single entry point for team tournament data access.
 * @param {{ allowFutureModes?: boolean, logger?: Console }} [options]
 */
export function createTeamTournamentRepository(options = {}) {
  const mode = resolveActiveTeamTournamentDataMode(options);

  switch (mode) {
    case TEAM_TOURNAMENT_DATA_MODES.SHADOW:
      return createShadowTeamTournamentRepository(options);
    case TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY:
    case TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY:
      return createCloudTeamTournamentRepository();
    case TEAM_TOURNAMENT_DATA_MODES.LEGACY:
    default:
      return createBlobTeamTournamentRepository();
  }
}

/** Singleton for orchestration layer. */
let repositorySingleton = null;

export function getTeamTournamentRepository(options = {}) {
  const merged = { allowFutureModes: true, ...options };
  if (!repositorySingleton || options.forceNew) {
    repositorySingleton = createTeamTournamentRepository(merged);
  }
  return repositorySingleton;
}

export {
  resolveTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "./teamTournamentDataMode.js";

export { isTeamTournamentCloudEnabled, resolveTeamTournamentStoreMode } from "./teamTournamentRepository.js";
