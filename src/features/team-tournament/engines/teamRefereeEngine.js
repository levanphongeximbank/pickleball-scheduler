import {
  LINEUP_STATUS,
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../constants.js";
import {
  findMatchup,
  findTeam,
  getLineup,
  normalizeTeamData,
} from "../models/index.js";
import { canManageTeam } from "./teamPermissionEngine.js";
import { computeMatchupResult } from "./teamResultEngine.js";
import { isRallyScoring, validateRallyScore } from "./rallyScoringEngine.js";

export const MATCH_FORMAT = {
  BEST_OF_1: "best_of_1",
  BEST_OF_3: "best_of_3",
};

const REFEREE_VISIBLE_MATCHUP_STATUSES = new Set([
  MATCHUP_STATUS.PUBLISHED,
  MATCHUP_STATUS.IN_PROGRESS,
  MATCHUP_STATUS.COMPLETED,
]);

export function getMatchFormat(discipline) {
  const format = discipline?.scoringFormat?.matchFormat;
  return format === MATCH_FORMAT.BEST_OF_3
    ? MATCH_FORMAT.BEST_OF_3
    : MATCH_FORMAT.BEST_OF_1;
}

export function normalizeGameScores(games = []) {
  if (!Array.isArray(games)) {
    return [];
  }

  return games.map((game) => ({
    teamA: Math.max(0, Number(game?.teamA) || 0),
    teamB: Math.max(0, Number(game?.teamB) || 0),
  }));
}

export function countGameWins(games = []) {
  let teamA = 0;
  let teamB = 0;

  for (const game of games) {
    if (game.teamA > game.teamB) {
      teamA += 1;
    } else if (game.teamB > game.teamA) {
      teamB += 1;
    }
  }

  return { teamA, teamB };
}

export function resolveSubMatchWinner({
  score,
  games = [],
  format = MATCH_FORMAT.BEST_OF_1,
  teamAId,
  teamBId,
}) {
  if (format === MATCH_FORMAT.BEST_OF_3) {
    const wins = countGameWins(games);
    if (wins.teamA > wins.teamB) {
      return teamAId;
    }
    if (wins.teamB > wins.teamA) {
      return teamBId;
    }
    return "";
  }

  const teamA = Number(score?.teamA) || 0;
  const teamB = Number(score?.teamB) || 0;

  if (teamA > teamB) {
    return teamAId;
  }
  if (teamB > teamA) {
    return teamBId;
  }
  return "";
}

export function isMatchupPublishedForReferee(matchup) {
  return REFEREE_VISIBLE_MATCHUP_STATUSES.has(matchup?.status);
}

export function hasOfficialLineups(teamData, matchup) {
  for (const teamId of [matchup.teamAId, matchup.teamBId]) {
    const lineup = getLineup(teamData, matchup.id, teamId);
    if (!lineup || lineup.status !== LINEUP_STATUS.PUBLISHED) {
      return false;
    }
  }
  return true;
}

export function hasLineupPlayersForDiscipline(teamData, matchup, disciplineId) {
  for (const teamId of [matchup.teamAId, matchup.teamBId]) {
    const lineup = getLineup(teamData, matchup.id, teamId);
    const playerIds = lineup?.selections?.[disciplineId] || [];
    if (playerIds.length === 0) {
      return false;
    }
  }
  return true;
}

export function canEditSubMatchResult(subMatch, { permissions = [] } = {}) {
  if (!subMatch) {
    return false;
  }

  if (subMatch.status !== SUB_MATCH_STATUS.COMPLETED) {
    return true;
  }

  return canManageTeam({ permissions });
}

export function validateSubMatchScoreInput({
  teamData,
  matchupId,
  subMatchId,
  score,
  games,
  confirm = false,
  permissions = [],
}) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  if (!isMatchupPublishedForReferee(matchup)) {
    return { ok: false, error: "Lượt đối đầu chưa được công bố." };
  }

  if (!hasOfficialLineups(teamData, matchup)) {
    return { ok: false, error: "Thiếu đội hình chính thức cho lượt đối đầu." };
  }

  const subMatch = matchup.subMatches.find((item) => item.id === subMatchId);
  if (!subMatch) {
    return { ok: false, error: "Không tìm thấy trận con." };
  }

  if (!canEditSubMatchResult(subMatch, { permissions })) {
    return {
      ok: false,
      error: "Kết quả đã xác nhận. Chỉ BTC/admin mới được sửa.",
    };
  }

  if (!hasLineupPlayersForDiscipline(teamData, matchup, subMatch.disciplineId)) {
    return { ok: false, error: "Thiếu VĐV trong đội hình chính thức." };
  }

  const discipline = teamData.disciplines.find(
    (item) => item.id === subMatch.disciplineId
  );
  const format = getMatchFormat(discipline);
  const rawTeamA = Number(score?.teamA);
  const rawTeamB = Number(score?.teamB);
  const normalizedGames = normalizeGameScores(games);
  const normalizedScore = {
    teamA: Math.max(0, Number.isFinite(rawTeamA) ? rawTeamA : 0),
    teamB: Math.max(0, Number.isFinite(rawTeamB) ? rawTeamB : 0),
  };

  if (
    (Number.isFinite(rawTeamA) && rawTeamA < 0) ||
    (Number.isFinite(rawTeamB) && rawTeamB < 0) ||
    (Array.isArray(games) &&
      games.some(
        (game) =>
          (Number.isFinite(Number(game?.teamA)) && Number(game.teamA) < 0) ||
          (Number.isFinite(Number(game?.teamB)) && Number(game.teamB) < 0)
      ))
  ) {
    return { ok: false, error: "Điểm số không được âm." };
  }

  if (format === MATCH_FORMAT.BEST_OF_3) {
    if (normalizedGames.length === 0) {
      return { ok: false, error: "Chưa nhập tỷ số game." };
    }

    for (const game of normalizedGames) {
      if (confirm && game.teamA === game.teamB) {
        return {
          ok: false,
          error: "Mỗi game phải có bên thắng khi xác nhận kết quả.",
        };
      }
    }

    const wins = countGameWins(normalizedGames);
    if (confirm && wins.teamA === wins.teamB) {
      return {
        ok: false,
        error: "Phải xác định được bên thắng trận con.",
      };
    }

    return {
      ok: true,
      format,
      score: wins,
      games: normalizedGames,
      discipline,
      matchup,
      subMatch,
    };
  }

  if (confirm && normalizedScore.teamA === normalizedScore.teamB) {
    return {
      ok: false,
      error: "Hai bên không được bằng điểm khi xác nhận kết quả.",
    };
  }

  if (confirm && discipline && isRallyScoring(discipline)) {
    const rallyCheck = validateRallyScore({
      scoreA: normalizedScore.teamA,
      scoreB: normalizedScore.teamB,
      rules: discipline.scoringFormat,
    });
    if (!rallyCheck.ok) {
      return rallyCheck;
    }
  }

  return {
    ok: true,
    format,
    score: normalizedScore,
    games: normalizedGames,
    discipline,
    matchup,
    subMatch,
  };
}

function applySubMatchUpdate(teamData, matchupId, subMatchId, updater) {
  const nextMatchups = teamData.matchups.map((item) => {
    if (item.id !== matchupId) {
      return item;
    }

    const subMatches = item.subMatches.map((subMatch) => {
      if (subMatch.id !== subMatchId) {
        return subMatch;
      }
      return updater(subMatch, item);
    });

    return { ...item, subMatches };
  });

  return normalizeTeamData({
    ...teamData,
    matchups: nextMatchups,
  });
}

function markMatchupInProgress(teamData, matchupId) {
  const nextMatchups = teamData.matchups.map((item) => {
    if (item.id !== matchupId) {
      return item;
    }

    if (item.status === MATCHUP_STATUS.PUBLISHED) {
      return { ...item, status: MATCHUP_STATUS.IN_PROGRESS };
    }

    return item;
  });

  return normalizeTeamData({
    ...teamData,
    matchups: nextMatchups,
  });
}

export function saveSubMatchDraft(teamData, payload = {}) {
  const validation = validateSubMatchScoreInput({
    teamData,
    ...payload,
    confirm: false,
  });

  if (!validation.ok) {
    return validation;
  }

  const { subMatch, score, games, format } = validation;
  const winnerTeamId = "";

  let nextData = applySubMatchUpdate(teamData, payload.matchupId, payload.subMatchId, () => ({
    ...subMatch,
    status: SUB_MATCH_STATUS.PLAYING,
    score:
      format === MATCH_FORMAT.BEST_OF_3
        ? { ...score, games }
        : { ...score, games: [] },
    winnerTeamId,
    resultConfirmedAt: null,
  }));

  nextData = markMatchupInProgress(nextData, payload.matchupId);

  return {
    ok: true,
    teamData: nextData,
    matchup: findMatchup(nextData, payload.matchupId),
    subMatch: findMatchup(nextData, payload.matchupId)?.subMatches.find(
      (item) => item.id === payload.subMatchId
    ),
  };
}

export function confirmSubMatchResult(teamData, payload = {}) {
  const validation = validateSubMatchScoreInput({
    teamData,
    ...payload,
    confirm: true,
  });

  if (!validation.ok) {
    return validation;
  }

  const { matchup, subMatch, score, games, format } = validation;
  const winnerTeamId = resolveSubMatchWinner({
    score,
    games,
    format,
    teamAId: matchup.teamAId,
    teamBId: matchup.teamBId,
  });

  if (!winnerTeamId) {
    return { ok: false, error: "Phải xác định được bên thắng trận con." };
  }

  let nextData = applySubMatchUpdate(teamData, payload.matchupId, payload.subMatchId, () => ({
    ...subMatch,
    status: SUB_MATCH_STATUS.COMPLETED,
    score:
      format === MATCH_FORMAT.BEST_OF_3
        ? { ...score, games }
        : { ...score, games: [] },
    winnerTeamId,
    resultConfirmedAt: new Date().toISOString(),
  }));

  nextData = markMatchupInProgress(nextData, payload.matchupId);
  const aggregated = computeMatchupResult(nextData, payload.matchupId);

  return {
    ok: true,
    teamData: aggregated.teamData,
    matchupResult: aggregated.result,
    subMatch: findMatchup(aggregated.teamData, payload.matchupId)?.subMatches.find(
      (item) => item.id === payload.subMatchId
    ),
  };
}

export function listRefereeMatchups(teamData) {
  return (teamData?.matchups || [])
    .filter((matchup) => isMatchupPublishedForReferee(matchup))
    .sort((left, right) => {
      const leftTime = left.scheduledAt
        ? new Date(left.scheduledAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      const rightTime = right.scheduledAt
        ? new Date(right.scheduledAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
}

function resolvePlayerNames(playerIds = [], players = []) {
  return playerIds.map((playerId) => {
    const player = players.find((item) => item.id === playerId);
    return player?.name || playerId;
  });
}

export function buildRefereeMatchupView(teamData, matchupId, players = []) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  if (!isMatchupPublishedForReferee(matchup)) {
    return { ok: false, error: "Lượt đối đầu chưa được công bố." };
  }

  const teamA = findTeam(teamData, matchup.teamAId);
  const teamB = findTeam(teamData, matchup.teamBId);
  const lineupA = getLineup(teamData, matchupId, matchup.teamAId);
  const lineupB = getLineup(teamData, matchupId, matchup.teamBId);

  const subMatches = matchup.subMatches.map((subMatch) => {
    const discipline = teamData.disciplines.find(
      (item) => item.id === subMatch.disciplineId
    );
    const format = getMatchFormat(discipline);
    const teamAPlayerIds = lineupA?.selections?.[subMatch.disciplineId] || [];
    const teamBPlayerIds = lineupB?.selections?.[subMatch.disciplineId] || [];

    return {
      subMatchId: subMatch.id,
      disciplineId: subMatch.disciplineId,
      disciplineName: discipline?.name || subMatch.disciplineId,
      format,
      teamAPlayerIds,
      teamBPlayerIds,
      teamAPlayerNames: resolvePlayerNames(teamAPlayerIds, players),
      teamBPlayerNames: resolvePlayerNames(teamBPlayerIds, players),
      status: subMatch.status,
      score: subMatch.score,
      winnerTeamId: subMatch.winnerTeamId,
      resultConfirmedAt: subMatch.resultConfirmedAt || null,
      hasOfficialLineup: hasLineupPlayersForDiscipline(
        teamData,
        matchup,
        subMatch.disciplineId
      ),
    };
  });

  return {
    ok: true,
    matchup: {
      id: matchup.id,
      status: matchup.status,
      scheduledAt: matchup.scheduledAt,
      courtLabel: matchup.courtLabel || "",
      teamAId: matchup.teamAId,
      teamBId: matchup.teamBId,
      teamAName: teamA?.name || matchup.teamAId,
      teamBName: teamB?.name || matchup.teamBId,
      result: matchup.result,
      subMatches,
    },
  };
}

export function listRefereeMatchupSummaries(teamData, players = []) {
  return listRefereeMatchups(teamData).map((matchup) => {
    const view = buildRefereeMatchupView(teamData, matchup.id, players);
    return view.ok ? view.matchup : null;
  }).filter(Boolean);
}
