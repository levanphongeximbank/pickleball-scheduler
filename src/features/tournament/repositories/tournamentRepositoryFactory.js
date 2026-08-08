import { createCloudTournamentRepository } from "./cloudTournamentRepository.js";
import { TOURNAMENT_REPOSITORY_KINDS } from "./TournamentRepository.interface.js";

/**
 * Canonical Tournament repository is CLOUD ONLY.
 * No transitional blob / localStorage / mock fallback in the active path.
 */
export function resolveTournamentDataMode() {
  return "cloud";
}

export const TOURNAMENT_DATA_MODES = Object.freeze({
  CLOUD: "cloud",
});

/**
 * @param {{ rpc?: Function, fresh?: boolean }} [options]
 */
export function createTournamentRepository(options = {}) {
  return createCloudTournamentRepository({ rpc: options.rpc });
}

let singleton = null;
let singletonRpc = null;

export function getTournamentRepository(options = {}) {
  if (options.rpc || options.fresh) {
    if (options.rpc) {
      singletonRpc = options.rpc;
      singleton = createTournamentRepository({ rpc: options.rpc });
      return singleton;
    }
    return createTournamentRepository(options);
  }
  if (!singleton) {
    singleton = createTournamentRepository(
      singletonRpc ? { rpc: singletonRpc } : {}
    );
  }
  return singleton;
}

/** @internal test helper */
export function __resetTournamentRepositorySingleton() {
  singleton = null;
  singletonRpc = null;
}

export function __setTournamentRepositoryRpcForTests(rpc) {
  singletonRpc = rpc;
  singleton = createTournamentRepository({ rpc });
  return singleton;
}

export { TOURNAMENT_REPOSITORY_KINDS };
