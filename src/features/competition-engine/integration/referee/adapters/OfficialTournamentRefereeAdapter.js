/**
 * OfficialTournamentRefereeAdapter — Competition Referee Adapter B translator.
 *
 * Separate from Internal even where legacy infrastructure is shared.
 * Official/Open registration and eligibility context remain explicit.
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
export function createOfficialTournamentRefereeAdapter(options = {}) {
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
    competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
    adapterId: String(
      options.adapterId || "official-tournament-referee-adapter-b"
    ).trim(),
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  });
}

export const OfficialTournamentRefereeAdapter = {
  create: createOfficialTournamentRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
};
