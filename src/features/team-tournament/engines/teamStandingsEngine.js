import { DEFAULT_TIE_BREAK_ORDER } from "../constants.js";
import {
  findTeam,
  normalizeStandings,
  normalizeTeamData,
} from "../models/index.js";

function emptyStanding(teamId) {
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
  };
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
    standingsMap.set(team.id, emptyStanding(team.id));
  });

  teamData.matchups.forEach((matchup) => {
    if (!matchup.result?.winnerTeamId) {
      return;
    }

    const teamA = standingsMap.get(matchup.teamAId) || emptyStanding(matchup.teamAId);
    const teamB = standingsMap.get(matchup.teamBId) || emptyStanding(matchup.teamBId);

    teamA.played += 1;
    teamB.played += 1;

    teamA.subMatchWins += matchup.result.teamAWins;
    teamA.subMatchLosses += matchup.result.teamBWins;
    teamB.subMatchWins += matchup.result.teamBWins;
    teamB.subMatchLosses += matchup.result.teamAWins;

    teamA.pointsScored += matchup.result.teamAPoints;
    teamA.pointsConceded += matchup.result.teamBPoints;
    teamB.pointsScored += matchup.result.teamBPoints;
    teamB.pointsConceded += matchup.result.teamAPoints;

    if (matchup.result.winnerTeamId === matchup.teamAId) {
      teamA.wins += 1;
      teamB.losses += 1;
      teamA.rankingPoints += 2;
      teamB.rankingPoints += 1;
    } else if (matchup.result.winnerTeamId === matchup.teamBId) {
      teamB.wins += 1;
      teamA.losses += 1;
      teamB.rankingPoints += 2;
      teamA.rankingPoints += 1;
    }

    teamA.subMatchDiff = teamA.subMatchWins - teamA.subMatchLosses;
    teamB.subMatchDiff = teamB.subMatchWins - teamB.subMatchLosses;

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
  const data = teamData.standings?.length
    ? teamData
    : computeTeamStandings(teamData);

  return data.standings.map((standing) => ({
    ...standing,
    teamName: findTeam(data, standing.teamId)?.name || standing.teamId,
  }));
}
