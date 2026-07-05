import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../models/tournament/index.js";
import { resolveBracketProgress } from "../tournament/engines/index.js";

const BRACKET_MODES = new Set([
  TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
]);

const STATUS_PRIORITY = {
  [TOURNAMENT_STATUS.ACTIVE]: 0,
  [TOURNAMENT_STATUS.READY]: 1,
  [TOURNAMENT_STATUS.REGISTRATION]: 2,
  [TOURNAMENT_STATUS.COMPLETED]: 3,
  [TOURNAMENT_STATUS.DRAFT]: 4,
  [TOURNAMENT_STATUS.CANCELLED]: 5,
};

export function getTournamentBracketPath(tournament) {
  if (!tournament?.id) {
    return null;
  }

  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return `/tournament/internal/${tournament.id}/bracket`;
  }

  if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return `/tournament/official/${tournament.id}/bracket`;
  }

  return null;
}

export function tournamentHasBracket(tournament) {
  const event = tournament?.events?.[0];
  if (!event) {
    return false;
  }

  const progress = resolveBracketProgress(event);
  return Boolean(progress?.rounds?.length);
}

export function isBracketTournament(tournament) {
  return BRACKET_MODES.has(tournament?.mode);
}

export function rankTournamentsForBracket(tournaments = [], { seasonId, leagueId } = {}) {
  return tournaments
    .filter((tournament) => isBracketTournament(tournament) && tournamentHasBracket(tournament))
    .map((tournament) => {
      let score = STATUS_PRIORITY[tournament.status] ?? 9;

      if (leagueId && String(tournament.leagueId) === String(leagueId)) {
        score -= 10;
      }

      if (seasonId && String(tournament.seasonId) === String(seasonId)) {
        score -= 5;
      }

      return { tournament, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }

      const aTime = Date.parse(a.tournament.updatedAt || a.tournament.createdAt || "") || 0;
      const bTime = Date.parse(b.tournament.updatedAt || b.tournament.createdAt || "") || 0;
      return bTime - aTime;
    })
    .map((item) => item.tournament);
}

export function getTournamentSetupPath(tournament) {
  if (!tournament?.id) {
    return "/tournament";
  }

  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return `/tournament/internal/${tournament.id}`;
  }

  if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return `/tournament/official/${tournament.id}`;
  }

  if (tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    return `/tournament/team/${tournament.id}`;
  }

  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return `/tournament/daily/${tournament.id}`;
  }

  return "/tournament";
}
