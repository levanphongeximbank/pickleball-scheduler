/**
 * B-18 — resolve organize/results hub picks onto existing canonical screens.
 * No new scoring, referee, results, or lifecycle writer.
 */
import {
  TOURNAMENT_ROUTES,
  directorPath,
  engineTabPath,
  isDirectorTournament,
  isEngineTournament,
  isIndividualTournament,
  isTeamTournament,
  teamTournamentPath,
  tournamentSetupPath,
  TEAM_TAB_QUERY,
} from "../../../config/tournamentRoutes.js";

export const ORGANIZE_INTENT = Object.freeze({
  PAIRING: "pairing",
  DIRECTOR: "director",
});

export const RESULTS_VIEW = Object.freeze({
  SCOREBOARD: "scoreboard",
  RANKINGS: "rankings",
  PLAYERS: "players",
});

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * @param {object|null|undefined} tournament
 * @param {string} [intent]
 * @returns {string}
 */
export function resolveOrganizeDestination(tournament, intent = "") {
  const normalizedIntent = normalizeToken(intent);
  if (!tournament?.id) {
    return TOURNAMENT_ROUTES.organizeHub;
  }
  if (isTeamTournament(tournament)) {
    return teamTournamentPath(tournament.id, TEAM_TAB_QUERY.matchups);
  }
  if (normalizedIntent === ORGANIZE_INTENT.DIRECTOR) {
    if (isDirectorTournament(tournament)) {
      return directorPath(tournament.id);
    }
    if (isEngineTournament(tournament)) {
      return engineTabPath(tournament.id, "courts");
    }
    return tournamentSetupPath(tournament);
  }
  if (normalizedIntent === ORGANIZE_INTENT.PAIRING) {
    if (isEngineTournament(tournament)) {
      return engineTabPath(tournament.id, "seed");
    }
    return tournamentSetupPath(tournament);
  }
  if (isEngineTournament(tournament)) {
    return engineTabPath(tournament.id, "engine");
  }
  if (isDirectorTournament(tournament)) {
    return directorPath(tournament.id);
  }
  return tournamentSetupPath(tournament);
}

/**
 * Scoreboard / rankings / player-stats all adopt Engine ranking or team standings.
 * @param {object|null|undefined} tournament
 * @param {string} [view]
 * @returns {string}
 */
export function resolveResultsDestination(tournament) {
  if (!tournament?.id) {
    return TOURNAMENT_ROUTES.resultsHub;
  }
  if (isTeamTournament(tournament)) {
    return teamTournamentPath(tournament.id, TEAM_TAB_QUERY.standings);
  }
  if (isIndividualTournament(tournament)) {
    return engineTabPath(tournament.id, "ranking");
  }
  return tournamentSetupPath(tournament);
}

export function isClubMisroutePath(path) {
  const pathOnly = String(path || "").split("?")[0];
  return (
    pathOnly === "/select-players" ||
    pathOnly === "/court-engine" ||
    pathOnly === "/statistics"
  );
}
