/**
 * Trusted-server reuse of frozen Competition Referee Adapter B (Contract #08).
 *
 * Adapter B remains translator + policy provider only.
 * It does NOT own referee identity, qualification, or availability.
 */

import {
  createDailyPlayRefereeAdapter,
  createInternalTournamentRefereeAdapter,
  createOfficialTournamentRefereeAdapter,
  createTeamTournamentRefereeAdapter,
} from "../../../../integration/referee/adapters/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
} from "../../../../integration/referee/constants.js";
import { isRefereeAdapterContractError } from "../../../../integration/referee/errors.js";
import { ASSIGNMENT_COMPETITION_MODE } from "../constants.js";
import { buildAdapterBModeState } from "./loadCanonicalCompetitionModeState.js";

function resolveAdapterMode(competitionMode) {
  const mode = String(competitionMode || "").trim().toUpperCase();
  if (mode === ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY) {
    return COMPETITION_REFEREE_MODE.DAILY_PLAY;
  }
  if (mode === ASSIGNMENT_COMPETITION_MODE.TEAM) {
    return COMPETITION_REFEREE_MODE.TEAM;
  }
  if (
    mode === ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN ||
    mode === "OFFICIAL"
  ) {
    return COMPETITION_REFEREE_MODE.OFFICIAL;
  }
  return COMPETITION_REFEREE_MODE.INTERNAL;
}

/**
 * @param {{
 *   tenantId: string,
 *   tournamentId: string,
 *   competitionMode?: string,
 *   canonical?: object|null,
 *   teamHeader?: object|null,
 * }} input
 */
export function createTrustedServerRefereeAdapterB(input = {}) {
  const adapterMode = resolveAdapterMode(input.competitionMode);
  const modeState = buildAdapterBModeState({
    ...input,
    competitionMode: adapterMode,
  });
  const options = { modeState };

  const adapter =
    adapterMode === COMPETITION_REFEREE_MODE.DAILY_PLAY
      ? createDailyPlayRefereeAdapter(options)
      : adapterMode === COMPETITION_REFEREE_MODE.TEAM
        ? createTeamTournamentRefereeAdapter(options)
        : adapterMode === COMPETITION_REFEREE_MODE.OFFICIAL
          ? createOfficialTournamentRefereeAdapter(options)
          : createInternalTournamentRefereeAdapter(options);

  return Object.freeze({
    adapter,
    modeState,
    adapterMode,
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    ownsRefereeIdentity: false,
    isRefereeAdapterContractError,
  });
}
