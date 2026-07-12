import { DEFAULT_TIE_BREAK_ORDER, MATCHUP_STATUS } from "../constants.js";
import {
  findTeam,
  normalizeStandings,
  normalizeTeamData,
} from "../models/index.js";

function emptyStanding(teamId, team = {}) {
  return {
    teamId,
    rank: 0,
    played: 0,
    wins: 0,
    losses: 0,
    subMatchWins: 0,
    subMatchLosses: 0,
    subMatchDiff: 0,
    pointsScored: 0,
    pointsConceded: 0,
    rankingPoints: 0,
    forfeitWins: 0,
    forfeitLosses: 0,
    withdrawn: Boolean(team.withdrawn),
  };
}

function isForfeitMatchup(matchup, result) {
  return (
    result?.forfeit === true ||
    result?.resultType === "forfeit" ||
    matchup?.resultType === "forfeit"
  );
}

function headToHeadWinner(teamAId, teamBId, matchups = []) {
  const direct = matchups.find(
    (matchup) =>
      matchup.result?.winnerTeamId &&
      ((matchup.teamAId === teamAId && matchup.teamBId === teamBId) ||
        (matchup.teamAId === teamBId && matchup.teamBId === teamAId))
  );

  return direct?.result?.winnerTeamId || "";
}

function compareByTiebreak(left, right, tiebreakKey, matchups) {
  switch (tiebreakKey) {
    case "wins":
      return right.wins - left.wins;
    case "subMatchDiff":
      return right.subMatchDiff - left.subMatchDiff;
    case "pointsScored":
      return right.pointsScored - left.pointsScored;
    case "headToHead": {
      const winner = headToHeadWinner(left.teamId, right.teamId, matchups);
      if (winner === left.teamId) {
        return -1;
      }
      if (winner === right.teamId) {
        return 1;
      }
      return 0;
    }
    case "manual":
    default:
      return String(left.teamId).localeCompare(String(right.teamId));
  }
}

export function computeTeamStandings(teamData) {
  const standingsMap = new Map();

  teamData.teams.forEach((team) => {
    standingsMap.set(team.id, emptyStanding(team.id, team));
  });

  teamData.matchups.forEach((matchup) => {
    const result = matchup.result;
    if (!result) {
      return;
    }

    const hasSubMatchResults = (result.teamAWins || 0) + (result.teamBWins || 0) > 0;
    const isCompleted = matchup.status === MATCHUP_STATUS.COMPLETED && result.winnerTeamId;

    if (!hasSubMatchResults && !isCompleted) {
      return;
    }

    const teamA =
      standingsMap.get(matchup.teamAId) ||
      emptyStanding(matchup.teamAId, findTeam(teamData, matchup.teamAId));
    const teamB =
      standingsMap.get(matchup.teamBId) ||
      emptyStanding(matchup.teamBId, findTeam(teamData, matchup.teamBId));

    if (hasSubMatchResults) {
      teamA.subMatchWins += result.teamAWins;
      teamA.subMatchLosses += result.teamBWins;
      teamB.subMatchWins += result.teamBWins;
      teamB.subMatchLosses += result.teamAWins;

      teamA.pointsScored += result.teamAPoints;
      teamA.pointsConceded += result.teamBPoints;
      teamB.pointsScored += result.teamBPoints;
      teamB.pointsConceded += result.teamAPoints;

      teamA.subMatchDiff = teamA.subMatchWins - teamA.subMatchLosses;
      teamB.subMatchDiff = teamB.subMatchWins - teamB.subMatchLosses;
    }

    if (isCompleted) {
      teamA.played += 1;
      teamB.played += 1;

      if (result.winnerTeamId === matchup.teamAId) {
        teamA.wins += 1;
        teamB.losses += 1;
        teamA.rankingPoints += 2;
        teamB.rankingPoints += 1;
      } else if (result.winnerTeamId === matchup.teamBId) {
        teamB.wins += 1;
        teamA.losses += 1;
        teamB.rankingPoints += 2;
        teamA.rankingPoints += 1;
      }

      if (isForfeitMatchup(matchup, result)) {
        const forfeitingTeamId =
          result.forfeitingTeamId ||
          matchup.forfeitingTeamId ||
          (result.winnerTeamId === matchup.teamAId ? matchup.teamBId : matchup.teamAId);

        if (forfeitingTeamId === matchup.teamAId) {
          teamA.forfeitLosses += 1;
          teamB.forfeitWins += 1;
        } else if (forfeitingTeamId === matchup.teamBId) {
          teamB.forfeitLosses += 1;
          teamA.forfeitWins += 1;
        }
      }
    }

    standingsMap.set(matchup.teamAId, teamA);
    standingsMap.set(matchup.teamBId, teamB);
  });

  const tiebreakOrder = teamData.settings?.tiebreakOrder || DEFAULT_TIE_BREAK_ORDER;
  const standings = [...standingsMap.values()].sort((left, right) => {
    for (const tiebreakKey of tiebreakOrder) {
      const delta = compareByTiebreak(left, right, tiebreakKey, teamData.matchups);
      if (delta !== 0) {
        return delta;
      }
    }
    return 0;
  });

  const ranked = standings.map((standing, index) => ({
    ...standing,
    rank: index + 1,
    teamName: findTeam(teamData, standing.teamId)?.name || standing.teamId,
  }));

  return normalizeTeamData({
    ...teamData,
    standings: normalizeStandings(ranked),
  });
}

export function getStandingsTable(teamData) {
  const data = computeTeamStandings(teamData);

  return data.standings.map((standing) => ({
    ...standing,
    teamName: findTeam(data, standing.teamId)?.name || standing.teamId,
  }));
}
