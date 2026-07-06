import { ACTIVATION_RULE, MATCHUP_STATUS, SUB_MATCH_STATUS } from "../constants.js";
import {
  findMatchup,
  normalizeTeamData,
} from "../models/index.js";
import { maybeActivateDreambreaker } from "./dreambreakerEngine.js";
import { isMlpFormat } from "./mlpPresetEngine.js";

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

function isMainDiscipline(teamData, disciplineId) {
  const discipline = teamData.disciplines.find((item) => item.id === disciplineId);
  return discipline?.activationRule === ACTIVATION_RULE.ALWAYS;
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

  const mainSubMatches = matchup.subMatches.filter((subMatch) =>
    isMainDiscipline(teamData, subMatch.disciplineId)
  );
  const dreambreakerSubMatch = matchup.subMatches.find(
    (subMatch) => !isMainDiscipline(teamData, subMatch.disciplineId)
  );

  mainSubMatches.forEach((subMatch) => {
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

  if (dreambreakerSubMatch) {
    const isFinalized =
      dreambreakerSubMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      dreambreakerSubMatch.status === SUB_MATCH_STATUS.FORFEIT;

    if (isFinalized) {
      teamAPoints += Number(dreambreakerSubMatch.score?.teamA) || 0;
      teamBPoints += Number(dreambreakerSubMatch.score?.teamB) || 0;

      if (dreambreakerSubMatch.winnerTeamId === matchup.teamAId) {
        teamAWins += 1;
      } else if (dreambreakerSubMatch.winnerTeamId === matchup.teamBId) {
        teamBWins += 1;
      }
    }
  }

  const allMainCompleted = mainSubMatches.every(
    (subMatch) =>
      subMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      subMatch.status === SUB_MATCH_STATUS.FORFEIT
  );

  const remainingMain = mainSubMatches.filter(
    (subMatch) =>
      subMatch.status !== SUB_MATCH_STATUS.COMPLETED &&
      subMatch.status !== SUB_MATCH_STATUS.FORFEIT
  ).length;

  const dreambreakerRequired =
    isMlpFormat(teamData) &&
    teamData.settings?.dreambreakerEnabled !== false &&
    allMainCompleted &&
    teamAWins === 2 &&
    teamBWins === 2;

  const dreambreakerFinished =
    dreambreakerSubMatch?.status === SUB_MATCH_STATUS.COMPLETED ||
    dreambreakerSubMatch?.status === SUB_MATCH_STATUS.FORFEIT ||
    matchup.dreambreaker?.status === "completed";

  const needsDreambreaker = dreambreakerRequired && !dreambreakerFinished;

  let winnerTeamId = "";
  if (dreambreakerFinished && dreambreakerSubMatch?.winnerTeamId) {
    winnerTeamId = dreambreakerSubMatch.winnerTeamId;
  } else if (teamAWins > teamBWins + remainingMain) {
    winnerTeamId = matchup.teamAId;
  } else if (teamBWins > teamAWins + remainingMain) {
    winnerTeamId = matchup.teamBId;
  } else if (allMainCompleted && !needsDreambreaker) {
    winnerTeamId =
      teamAWins > teamBWins
        ? matchup.teamAId
        : teamBWins > teamAWins
          ? matchup.teamBId
          : "";
  }

  const allCompleted =
    allMainCompleted &&
    (!dreambreakerRequired || dreambreakerFinished) &&
    Boolean(winnerTeamId);

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

  let nextData = normalizeTeamData({
    ...teamData,
    matchups: nextMatchups,
  });

  if (needsDreambreaker) {
    const activation = maybeActivateDreambreaker(nextData, matchupId);
    nextData = activation.teamData;
  }

  const finalMatchup = findMatchup(nextData, matchupId);

  return {
    ok: true,
    teamData: nextData,
    result: finalMatchup?.result || {
      teamAWins,
      teamBWins,
      teamAPoints,
      teamBPoints,
      winnerTeamId,
    },
    needsDreambreaker,
  };
}
