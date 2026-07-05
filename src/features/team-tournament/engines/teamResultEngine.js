import { MATCHUP_STATUS, SUB_MATCH_STATUS } from "../constants.js";
import {
  findMatchup,
  normalizeTeamData,
} from "../models/index.js";

function resolveWinner(score, teamAId, teamBId) {
  if (!score) {
    return "";
  }

  if (score.teamA > score.teamB) {
    return teamAId;
  }

  if (score.teamB > score.teamA) {
    return teamBId;
  }

  return "";
}

export function recordSubMatchResult(teamData, {
  matchupId,
  subMatchId,
  score,
  status = SUB_MATCH_STATUS.COMPLETED,
}) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  const nextScore = {
    teamA: Number(score?.teamA) || 0,
    teamB: Number(score?.teamB) || 0,
  };

  const nextMatchups = teamData.matchups.map((item) => {
    if (item.id !== matchupId) {
      return item;
    }

    const subMatches = item.subMatches.map((subMatch) => {
      if (subMatch.id !== subMatchId) {
        return subMatch;
      }

      const winnerTeamId = resolveWinner(nextScore, item.teamAId, item.teamBId);

      return {
        ...subMatch,
        score: nextScore,
        status,
        winnerTeamId,
      };
    });

    return { ...item, subMatches };
  });

  const nextData = normalizeTeamData({
    ...teamData,
    matchups: nextMatchups,
  });

  const result = computeMatchupResult(nextData, matchupId);

  return {
    ok: true,
    teamData: result.teamData,
    matchupResult: result.result,
  };
}

export function computeMatchupResult(teamData, matchupId) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  let teamAWins = 0;
  let teamBWins = 0;
  let teamAPoints = 0;
  let teamBPoints = 0;

  matchup.subMatches.forEach((subMatch) => {
    const discipline = teamData.disciplines.find((item) => item.id === subMatch.disciplineId);
    if (discipline && discipline.countsTowardResult === false) {
      return;
    }

    const isFinalized =
      subMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      subMatch.status === SUB_MATCH_STATUS.FORFEIT;

    if (!isFinalized) {
      return;
    }

    teamAPoints += Number(subMatch.score?.teamA) || 0;
    teamBPoints += Number(subMatch.score?.teamB) || 0;

    if (subMatch.winnerTeamId === matchup.teamAId) {
      teamAWins += 1;
    } else if (subMatch.winnerTeamId === matchup.teamBId) {
      teamBWins += 1;
    }
  });

  const winnerTeamId =
    teamAWins > teamBWins
      ? matchup.teamAId
      : teamBWins > teamAWins
        ? matchup.teamBId
        : "";

  const allCompleted = matchup.subMatches.every(
    (subMatch) =>
      subMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      subMatch.status === SUB_MATCH_STATUS.FORFEIT
  );

  const nextMatchups = teamData.matchups.map((item) => {
    if (item.id !== matchupId) {
      return item;
    }

    return {
      ...item,
      result: {
        teamAWins,
        teamBWins,
        teamAPoints,
        teamBPoints,
        winnerTeamId,
      },
      status: allCompleted ? MATCHUP_STATUS.COMPLETED : item.status,
    };
  });

  return {
    ok: true,
    teamData: normalizeTeamData({
      ...teamData,
      matchups: nextMatchups,
    }),
    result: {
      teamAWins,
      teamBWins,
      teamAPoints,
      teamBPoints,
      winnerTeamId,
    },
  };
}
