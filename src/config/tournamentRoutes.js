/**
 * Route thật cho menu Giải đấu V5.
 * Dùng chung bởi navigationConfig, router, hub pages.
 */
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../models/tournament/constants.js";

export const TOURNAMENT_ROUTES = Object.freeze({
  overview: "/tournament",
  list: "/tournament/list",
  create: "/tournament/create",
  typeIndividual: "/tournament/types/individual",
  typeTeam: "/tournament/types/team",
  register: "/tournament/register",
  teams: "/tournament/teams",
  teamPresets: "/tournament/teams/presets",
  teamBuildManual: "/tournament/teams/build/manual",
  teamBuildRandom: "/tournament/teams/build/random",
  teamBuildDraft: "/tournament/teams/build/draft",
  pairing: "/select-players",
  draw: "/tournament/bracket",
  schedule: "/tournament/schedule",
  bracket: "/tournament/bracket",
  director: "/court-engine",
  referee: "/referee",
  scoreEntry: "/referee",
  matchReports: "/tournament/match-reports",
  resultsScoreboard: "/statistics?view=scoreboard",
  resultsRankings: "/statistics?view=rankings",
  resultsPlayers: "/statistics?view=players",
  configFormat: "/tournament/config/format",
  configScoring: "/settings",
  configSkill: "/players",
  configSettings: "/tournament/config/settings",
  typesHub: "/tournament/types",
  rosterHub: "/tournament/roster",
  organizeHub: "/tournament/organize",
  operationsHub: "/tournament/operations",
  resultsHub: "/tournament/results",
  configHub: "/tournament/config",
  eligibility: "/tournament/eligibility",
  entryFee: "/tournament/entry-fee",
  configAgeRules: "/tournament/config/age-rules",
  configGenderRules: "/tournament/config/gender-rules",
  configFee: "/tournament/config/fee",
  configRegulations: "/tournament/config/regulations",
  publishSchedule: "/tournament/publish-schedule",
  refereeAssign: "/tournament/referee-assign",
  awards: "/tournament/awards",
  withdrawal: "/tournament/withdrawal",
  reportsHub: "/reports",
  aiHub: "/ai",
  supportHub: "/support",
});

export const TEAM_TAB_QUERY = Object.freeze({
  teams: "teams",
  disciplines: "disciplines",
  matchups: "matchups",
  standings: "standings",
});

export function teamTournamentPath(tournamentId, tab = TEAM_TAB_QUERY.teams) {
  return `/tournament/team/${tournamentId}?tab=${tab}`;
}

export function engineTabPath(tournamentId, tab = "setup") {
  if (!tournamentId) return TOURNAMENT_ROUTES.overview;
  if (tab === "setup" || tab === "engine") {
    return `/tournaments/${tournamentId}/engine`;
  }
  return `/tournaments/${tournamentId}/${tab}`;
}

export function directorPath(tournamentId) {
  return `/tournament/director/${tournamentId}`;
}

export const INDIVIDUAL_MODES = new Set([
  TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
]);

export function isIndividualTournament(tournament) {
  return INDIVIDUAL_MODES.has(tournament?.mode);
}

export function isTeamTournament(tournament) {
  return tournament?.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT;
}

export function isRegisterableTournament(tournament) {
  if (!tournament || tournament.status === TOURNAMENT_STATUS.CANCELLED) {
    return false;
  }
  return (
    tournament.status === TOURNAMENT_STATUS.REGISTRATION ||
    tournament.status === TOURNAMENT_STATUS.DRAFT ||
    tournament.status === TOURNAMENT_STATUS.READY
  );
}

export function isSchedulableTournament(tournament) {
  if (!tournament || tournament.status === TOURNAMENT_STATUS.CANCELLED) {
    return false;
  }
  return (
    tournament.status === TOURNAMENT_STATUS.ACTIVE ||
    tournament.status === TOURNAMENT_STATUS.READY ||
    tournament.status === TOURNAMENT_STATUS.REGISTRATION
  );
}

export function isDirectorTournament(tournament) {
  return isSchedulableTournament(tournament) && isIndividualTournament(tournament);
}

export function isEngineTournament(tournament) {
  return isIndividualTournament(tournament) && tournament.status !== TOURNAMENT_STATUS.CANCELLED;
}
