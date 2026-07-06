import { TOURNAMENT_MODE } from "../../../../models/tournament/index.js";

export function buildDirectorBackPath(tournament, tournamentId) {
  if (!tournament) {
    return "/tournament";
  }

  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return `/tournament/daily/${tournamentId}`;
  }

  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return `/tournament/internal/${tournamentId}`;
  }

  if (tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    return `/tournament/team/${tournamentId}`;
  }

  return `/tournament/official/${tournamentId}`;
}
