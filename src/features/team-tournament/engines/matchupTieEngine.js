import {
  ACTIVATION_RULE,
  DISCIPLINE_KIND,
  DREAMBREAKER_STATUS,
  SUB_MATCH_STATUS,
} from "../constants.js";
import { isMlpFormat } from "./mlpPresetEngine.js";

function isMainDiscipline(discipline) {
  if (!discipline) {
    return false;
  }
  if (
    discipline.disciplineKind === DISCIPLINE_KIND.DREAMBREAKER ||
    discipline.activationRule === ACTIVATION_RULE.TIE_AT_2_2
  ) {
    return false;
  }
  if (discipline.activationRule === ACTIVATION_RULE.ALWAYS) {
    return true;
  }
  // Captain scoped payloads historically omit activationRule on MLP mains.
  return !discipline.activationRule;
}

function getMainSubMatches(teamData, matchup) {
  const mainDisciplineIds = new Set(
    (teamData.disciplines || [])
      .filter((discipline) => isMainDiscipline(discipline))
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
