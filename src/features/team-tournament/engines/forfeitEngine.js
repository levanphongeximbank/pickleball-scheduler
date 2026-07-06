import { DISCIPLINE_KIND, SUB_MATCH_STATUS } from "../constants.js";
import { findMatchup, normalizeTeamData } from "../models/index.js";
import { getDreambreakerDiscipline } from "./mlpPresetEngine.js";

export function isDreambreakerSubMatch(teamData, subMatch) {
  const discipline = teamData.disciplines.find(
    (item) => item.id === subMatch.disciplineId
  );
  return discipline?.disciplineKind === DISCIPLINE_KIND.DREAMBREAKER;
}

export function forfeitDoublesSubMatch(teamData, {
  matchupId,
  subMatchId,
  forfeitingTeamId,
  currentScoreA = 0,
  currentScoreB = 0,
}) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  const subMatch = matchup.subMatches.find((item) => item.id === subMatchId);
  if (!subMatch) {
    return { ok: false, error: "Không tìm thấy trận con." };
  }

  if (isDreambreakerSubMatch(teamData, subMatch)) {
    return { ok: false, error: "Dùng forfeit Dreambreaker cho trận quyết định." };
  }

  const isTeamA = forfeitingTeamId === matchup.teamAId;
  const isTeamB = forfeitingTeamId === matchup.teamBId;
  if (!isTeamA && !isTeamB) {
    return { ok: false, error: "Đội forfeit không hợp lệ." };
  }

  const scoreA = Number(currentScoreA) || subMatch.score?.teamA || 0;
  const scoreB = Number(currentScoreB) || subMatch.score?.teamB || 0;
  const winnerTeamId = isTeamA ? matchup.teamBId : matchup.teamAId;
  const finalA = isTeamA ? scoreA : Math.max(scoreB, 21);
  const finalB = isTeamB ? scoreB : Math.max(scoreA, 21);

  const nextMatchups = teamData.matchups.map((item) => {
    if (item.id !== matchupId) {
      return item;
    }

    const subMatches = item.subMatches.map((entry) => {
      if (entry.id !== subMatchId) {
        return entry;
      }

      return {
        ...entry,
        status: SUB_MATCH_STATUS.FORFEIT,
        score: { teamA: finalA, teamB: finalB, games: [] },
        winnerTeamId,
        resultConfirmedAt: new Date().toISOString(),
      };
    });

    return { ...item, subMatches };
  });

  return {
    ok: true,
    teamData: normalizeTeamData({ ...teamData, matchups: nextMatchups }),
    winnerTeamId,
    score: { teamA: finalA, teamB: finalB },
  };
}

export function forfeitDreambreakerInjury(teamData, { matchupId, teamId, injuredPlayerId }) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup?.dreambreaker) {
    return { ok: false, error: "Dreambreaker chưa kích hoạt." };
  }

  const isTeamA = teamId === matchup.teamAId;
  const order = isTeamA ? matchup.dreambreaker.teamAOrder : matchup.dreambreaker.teamBOrder;
  if (!order.includes(injuredPlayerId)) {
    return { ok: false, error: "VĐV không có trong thứ tự Dreambreaker." };
  }

  const segmentIndex = matchup.dreambreaker.rotation?.segmentIndex || 0;
  const injurySkips = [
    ...(matchup.dreambreaker.rotation?.injurySkips || []),
    {
      teamId,
      skippedPlayerId: injuredPlayerId,
      atSegment: segmentIndex,
    },
  ];

  const nextMatchups = teamData.matchups.map((item) =>
    item.id === matchupId
      ? {
          ...item,
          dreambreaker: {
            ...item.dreambreaker,
            rotation: {
              ...item.dreambreaker.rotation,
              injurySkips,
            },
          },
        }
      : item
  );

  return {
    ok: true,
    teamData: normalizeTeamData({ ...teamData, matchups: nextMatchups }),
  };
}

export function getDreambreakerDisciplineId(teamData) {
  return getDreambreakerDiscipline(teamData.disciplines)?.id || "";
}
