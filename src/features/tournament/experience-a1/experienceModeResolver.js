/**
 * Tournament Experience mode resolver (Wave O1).
 *
 * Canonical Tournament Experience pages resolve through this boundary so
 * Official/Open projections can bind an Official adapter without a second shell.
 */

import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { isIndividualTournament, isTeamTournament } from "../../../config/tournamentRoutes.js";
import { createOfficialTournamentExperienceAdapter } from "../official-tournament-experience/officialTournamentExperienceAdapter.js";

export const TOURNAMENT_EXPERIENCE_MODE = Object.freeze({
  INTERNAL: "internal",
  OFFICIAL: "official",
  TEAM: "team",
  DAILY: "daily",
  UNKNOWN: "unknown",
});

/**
 * @param {object|null|undefined} tournament
 * @returns {typeof TOURNAMENT_EXPERIENCE_MODE[keyof typeof TOURNAMENT_EXPERIENCE_MODE]}
 */
export function resolveTournamentExperienceMode(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return TOURNAMENT_EXPERIENCE_MODE.UNKNOWN;
  }
  if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return TOURNAMENT_EXPERIENCE_MODE.OFFICIAL;
  }
  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return TOURNAMENT_EXPERIENCE_MODE.INTERNAL;
  }
  if (isTeamTournament(tournament)) {
    return TOURNAMENT_EXPERIENCE_MODE.TEAM;
  }
  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return TOURNAMENT_EXPERIENCE_MODE.DAILY;
  }
  if (isIndividualTournament(tournament)) {
    return TOURNAMENT_EXPERIENCE_MODE.INTERNAL;
  }
  return TOURNAMENT_EXPERIENCE_MODE.UNKNOWN;
}

/**
 * Resolve the thin experience adapter for the tournament family.
 * O1: Official only. Other modes return null (canonical pages keep direct reads).
 *
 * @param {object|null|undefined} tournament
 * @param {{ selectedEventId?: string }} [options]
 */
export function resolveTournamentExperienceAdapter(tournament, options = {}) {
  const mode = resolveTournamentExperienceMode(tournament);
  if (mode !== TOURNAMENT_EXPERIENCE_MODE.OFFICIAL) {
    return null;
  }
  return createOfficialTournamentExperienceAdapter(tournament, options);
}

export function isOfficialTournamentExperience(tournament) {
  return resolveTournamentExperienceMode(tournament) === TOURNAMENT_EXPERIENCE_MODE.OFFICIAL;
}
