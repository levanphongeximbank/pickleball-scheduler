/**
 * Mode resolver — picks Experience Adapter by tournament mode.
 * Individual stays on existing A1 Individual pages; Team uses Team adapter.
 */
import { TOURNAMENT_MODE } from "../../../../models/tournament/constants.js";
import { isIndividualTournament, isTeamTournament } from "../../../../config/tournamentRoutes.js";
import { TeamTournamentExperienceAdapter } from "./TeamTournamentExperienceAdapter.js";
import { resolveTeamExperienceOpenPath, teamOverviewPath } from "./teamExperienceRoutes.js";
import { individualOverviewPath } from "../routes.js";

export const TOURNAMENT_EXPERIENCE_MODE = Object.freeze({
  INDIVIDUAL: "INDIVIDUAL",
  TEAM_TOURNAMENT: TOURNAMENT_MODE.TEAM_TOURNAMENT,
  DAILY_PLAY: TOURNAMENT_MODE.DAILY_PLAY,
  UNKNOWN: "UNKNOWN",
});

export function resolveTournamentExperienceMode(tournament) {
  if (isTeamTournament(tournament)) {
    return TOURNAMENT_EXPERIENCE_MODE.TEAM_TOURNAMENT;
  }
  if (isIndividualTournament(tournament)) {
    return TOURNAMENT_EXPERIENCE_MODE.INDIVIDUAL;
  }
  if (tournament?.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return TOURNAMENT_EXPERIENCE_MODE.DAILY_PLAY;
  }
  return TOURNAMENT_EXPERIENCE_MODE.UNKNOWN;
}

export function resolveExperienceAdapter(tournament) {
  const mode = resolveTournamentExperienceMode(tournament);
  if (mode === TOURNAMENT_EXPERIENCE_MODE.TEAM_TOURNAMENT) {
    return TeamTournamentExperienceAdapter;
  }
  return null;
}

export function resolveCanonicalExperienceOpenPath(tournament) {
  const mode = resolveTournamentExperienceMode(tournament);
  if (mode === TOURNAMENT_EXPERIENCE_MODE.TEAM_TOURNAMENT) {
    return resolveTeamExperienceOpenPath(tournament);
  }
  if (mode === TOURNAMENT_EXPERIENCE_MODE.INDIVIDUAL) {
    return individualOverviewPath(tournament?.id);
  }
  if (mode === TOURNAMENT_EXPERIENCE_MODE.DAILY_PLAY) {
    const id = String(tournament?.id || "").trim();
    return id ? `/tournament/daily/${encodeURIComponent(id)}` : "/tournament";
  }
  return "/tournament";
}

export { teamOverviewPath, resolveTeamExperienceOpenPath };
