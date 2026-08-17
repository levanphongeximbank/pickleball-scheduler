/**
 * InternalTournamentRefereeAdapter — Competition Referee Adapter B translator.
 *
 * Translates Internal tournament match state into End A.
 * Legacy token / tournament_match_live are compatibility evidence only.
 */

import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
} from "../constants.js";
import {
  assertIndividualModeStateSafe,
  createIndividualTournamentRefereeAdapterSurface,
} from "./shared/individualTournamentMapping.js";
import { resolveInjectedModeState } from "./shared/modeContext.js";

/**
 * @param {{
 *   adapterId?: string,
 *   modeState?: object,
 *   getModeState?: (request: object) => object,
 * }} [options]
 */
export function createInternalTournamentRefereeAdapter(options = {}) {
  const wrapped = {
    ...options,
    getModeState(request) {
      const state = resolveInjectedModeState(options, request);
      assertIndividualModeStateSafe(state);
      return state;
    },
  };

  return createIndividualTournamentRefereeAdapterSurface({
    options: wrapped,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    adapterId: String(
      options.adapterId || "internal-tournament-referee-adapter-b"
    ).trim(),
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  });
}

export const InternalTournamentRefereeAdapter = {
  create: createInternalTournamentRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
};
