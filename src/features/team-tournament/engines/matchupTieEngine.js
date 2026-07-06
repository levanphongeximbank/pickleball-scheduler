import {
  ACTIVATION_RULE,
  DREAMBREAKER_STATUS,
  SUB_MATCH_STATUS,
} from "../constants.js";
import { isMlpFormat } from "./mlpPresetEngine.js";

function getMainSubMatches(teamData, matchup) {
  const mainDisciplineIds = new Set(
    (teamData.disciplines || [])
      .filter((discipline) => discipline.activationRule === ACTIVATION_RULE.ALWAYS)
      .map((discipline) => discipline.id)
  );

  return (matchup.subMatches || []).filter((subMatch) =>
    mainDisciplineIds.has(subMatch.disciplineId)
  );
}

function countFinalizedWins(matchup, subMatches) {
  let teamAWins = 0;
  let teamBWins = 0;

  subMatches.forEach((subMatch) => {
    const finalized =
      subMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      subMatch.status === SUB_MATCH_STATUS.FORFEIT;

    if (!finalized) {
      return;
    }

    if (subMatch.winnerTeamId === matchup.teamAId) {
      teamAWins += 1;
    } else if (subMatch.winnerTeamId === matchup.teamBId) {
      teamBWins += 1;
    }
  });

  return { teamAWins, teamBWins };
}

export function computeMatchupTieProgress(teamData, matchup) {
  const mainSubMatches = getMainSubMatches(teamData, matchup);
  const { teamAWins, teamBWins } = countFinalizedWins(matchup, mainSubMatches);

  const allMainDone = mainSubMatches.every(
    (subMatch) =>
      subMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      subMatch.status === SUB_MATCH_STATUS.FORFEIT
  );

  const dreambreakerEnabled =
    isMlpFormat(teamData) && teamData.settings?.dreambreakerEnabled !== false;

  const needsDreambreaker =
    dreambreakerEnabled && allMainDone && teamAWins === 2 && teamBWins === 2;

  const dreambreakerStatus = matchup.dreambreaker?.status || DREAMBREAKER_STATUS.PENDING;

  const dreambreakerFinished = dreambreakerStatus === DREAMBREAKER_STATUS.COMPLETED;

  const tieDecided =
    (allMainDone && !needsDreambreaker && teamAWins !== teamBWins) ||
    dreambreakerFinished;

  const tieClinchedEarly = teamAWins >= 3 || teamBWins >= 3;

  return {
    teamAWins,
    teamBWins,
    allMainDone,
    needsDreambreaker,
    dreambreakerEnabled,
    dreambreakerStatus,
    dreambreakerFinished,
    tieDecided: tieDecided || tieClinchedEarly,
    tieClinchedEarly,
    scoreLabel: `${teamAWins}–${teamBWins}`,
  };
}

export function countDreambreakerPendingMatchups(teamData) {
  return (teamData.matchups || []).filter((matchup) => {
    const progress = computeMatchupTieProgress(teamData, matchup);
    return (
      progress.needsDreambreaker &&
      progress.dreambreakerStatus !== DREAMBREAKER_STATUS.COMPLETED
    );
  }).length;
}
