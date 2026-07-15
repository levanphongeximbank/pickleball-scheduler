/**
 * Team standings + S2-E multi-way mini-table / tie-break freeze.
 */

import { DEFAULT_TIE_BREAK_ORDER, MATCHUP_STATUS } from "../constants.js";
import {
  findTeam,
  normalizeStandings,
  normalizeTeamData,
} from "../models/index.js";

export const TIEBREAK_KEYS = Object.freeze([
  "wins",
  "subMatchDiff",
  "pointsScored",
  "headToHead",
  "miniTable",
  "manual",
]);

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
    tieBreakNote: "",
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

function applyMatchupToStanding(standingsMap, teamData, matchup) {
  const result = matchup.result;
  if (!result) {
    return;
  }

  const hasSubMatchResults = (result.teamAWins || 0) + (result.teamBWins || 0) > 0;
  const isCompleted = matchup.status === MATCHUP_STATUS.COMPLETED && result.winnerTeamId;

  if (!hasSubMatchResults && !isCompleted) {
    return;
  }

  if (!matchup.teamAId || !matchup.teamBId) {
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
}

function accumulateStandings(teamData, matchups = teamData.matchups || []) {
  const standingsMap = new Map();

  (teamData.teams || []).forEach((team) => {
    standingsMap.set(team.id, emptyStanding(team.id, team));
  });

  matchups.forEach((matchup) => {
    applyMatchupToStanding(standingsMap, teamData, matchup);
  });

  return standingsMap;
}

/** Mini-table: stats only from matches among the tied team ids. */
export function buildMiniTableStats(tiedTeamIds = [], matchups = [], teamData = {}) {
  const tiedSet = new Set(tiedTeamIds.map(String));
  const standingsMap = new Map();
  tiedTeamIds.forEach((id) => {
    standingsMap.set(String(id), emptyStanding(String(id), findTeam(teamData, id)));
  });

  (matchups || []).forEach((matchup) => {
    if (
      !tiedSet.has(String(matchup.teamAId)) ||
      !tiedSet.has(String(matchup.teamBId))
    ) {
      return;
    }
    applyMatchupToStanding(standingsMap, teamData, matchup);
  });

  return standingsMap;
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
    case "miniTable":
      return 0;
    case "manual":
    default:
      return String(left.teamId).localeCompare(String(right.teamId));
  }
}

function partitionEqual(sorted, equalsFn) {
  const groups = [];
  let current = [];
  sorted.forEach((row, index) => {
    if (index === 0) {
      current = [row];
      return;
    }
    if (equalsFn(sorted[index - 1], row)) {
      current.push(row);
    } else {
      groups.push(current);
      current = [row];
    }
  });
  if (current.length) {
    groups.push(current);
  }
  return groups;
}

function resolveTiedGroup(rows, matchups, keys, teamData, depth = 0) {
  if (rows.length <= 1) {
    return rows;
  }
  if (depth > 8 || !keys.length) {
    return [...rows]
      .sort((a, b) => String(a.teamId).localeCompare(String(b.teamId)))
      .map((row) => ({
        ...row,
        tieBreakNote: row.tieBreakNote || "manual/id",
      }));
  }

  const key = keys[0];
  const rest = keys.slice(1);

  // 3+ way: mini-table among tied teams (S2-E)
  if ((key === "headToHead" || key === "miniTable") && rows.length >= 3) {
    const mini = buildMiniTableStats(
      rows.map((row) => row.teamId),
      matchups,
      teamData
    );
    const sorted = [...rows].sort((a, b) => {
      const left = mini.get(String(a.teamId));
      const right = mini.get(String(b.teamId));
      for (const miniKey of ["wins", "subMatchDiff", "pointsScored"]) {
        const delta = compareByTiebreak(left, right, miniKey, matchups);
        if (delta !== 0) {
          return delta;
        }
      }
      return 0;
    });

    const groups = partitionEqual(sorted, (a, b) => {
      const left = mini.get(String(a.teamId));
      const right = mini.get(String(b.teamId));
      return (
        left.wins === right.wins &&
        left.subMatchDiff === right.subMatchDiff &&
        left.pointsScored === right.pointsScored
      );
    });

    return groups.flatMap((group) => {
      if (group.length === 1) {
        return [
          {
            ...group[0],
            tieBreakNote: "mini-table",
          },
        ];
      }
      return resolveTiedGroup(
        group.map((row) => ({ ...row, tieBreakNote: "mini-table" })),
        matchups,
        rest,
        teamData,
        depth + 1
      );
    });
  }

  if (key === "headToHead" && rows.length === 2) {
    const winner = headToHeadWinner(rows[0].teamId, rows[1].teamId, matchups);
    if (winner === rows[0].teamId) {
      return [
        { ...rows[0], tieBreakNote: "H2H" },
        { ...rows[1], tieBreakNote: "H2H" },
      ];
    }
    if (winner === rows[1].teamId) {
      return [
        { ...rows[1], tieBreakNote: "H2H" },
        { ...rows[0], tieBreakNote: "H2H" },
      ];
    }
    return resolveTiedGroup(rows, matchups, rest, teamData, depth + 1);
  }

  if (key === "miniTable") {
    return resolveTiedGroup(rows, matchups, rest, teamData, depth + 1);
  }

  const sorted = [...rows].sort((a, b) =>
    compareByTiebreak(a, b, key, matchups)
  );

  const groups = partitionEqual(
    sorted,
    (a, b) => compareByTiebreak(a, b, key, matchups) === 0
  );

  return groups.flatMap((group) => {
    if (group.length === 1) {
      return group;
    }
    return resolveTiedGroup(group, matchups, rest, teamData, depth + 1);
  });
}

/**
 * Rank standings rows with multi-way mini-table support (S2-E).
 */
export function rankStandingsRows(rows, matchups, tiebreakOrder, teamData = {}) {
  const keys =
    Array.isArray(tiebreakOrder) && tiebreakOrder.length
      ? tiebreakOrder
      : DEFAULT_TIE_BREAK_ORDER;

  // Ensure mini-table can run for 3+ ties even if only headToHead is configured
  const effectiveKeys = keys.includes("miniTable")
    ? keys
    : keys.flatMap((key) => (key === "headToHead" ? ["headToHead", "miniTable"] : [key]));

  const active = rows.filter((row) => !row.withdrawn);
  const withdrawn = rows.filter((row) => row.withdrawn);

  // Seed recursive sort: start with one big group
  const ordered = resolveTiedGroup(active, matchups, effectiveKeys, teamData, 0);
  const trailing = withdrawn.sort((a, b) =>
    String(a.teamId).localeCompare(String(b.teamId))
  );

  return [...ordered, ...trailing].map((row, index) => ({
    ...row,
    rank: index + 1,
    teamName: row.teamName || findTeam(teamData, row.teamId)?.name || row.teamId,
  }));
}

export function isTiebreakFrozen(teamData) {
  const settings = teamData?.settings || {};
  if (settings.tiebreakFrozen === true) {
    return true;
  }
  if (settings.tiebreakFrozenAt) {
    return true;
  }
  if (teamData?.knockout?.generatedAt) {
    return true;
  }
  return false;
}

export function freezeTiebreakOrder(teamData, options = {}) {
  if (isTiebreakFrozen(teamData)) {
    return { ok: true, teamData, alreadyFrozen: true };
  }
  return {
    ok: true,
    teamData: normalizeTeamData({
      ...teamData,
      settings: {
        ...(teamData.settings || {}),
        tiebreakFrozen: true,
        tiebreakFrozenAt: options.at || new Date().toISOString(),
        tiebreakFrozenReason: options.reason || "manual",
      },
    }),
  };
}

export function setTiebreakOrder(teamData, nextOrder = []) {
  if (isTiebreakFrozen(teamData)) {
    return {
      ok: false,
      error: "Thứ tự tie-break đã khóa (sau khi tạo knockout hoặc BTC đã đóng).",
      code: "TIEBREAK_FROZEN",
    };
  }

  const cleaned = (nextOrder || []).filter((key) => TIEBREAK_KEYS.includes(key));
  if (!cleaned.length) {
    return { ok: false, error: "Thứ tự tie-break không hợp lệ.", code: "INVALID_ORDER" };
  }

  return {
    ok: true,
    teamData: normalizeTeamData({
      ...teamData,
      settings: {
        ...(teamData.settings || {}),
        tiebreakOrder: cleaned,
      },
    }),
  };
}

export function computeTeamStandings(teamData) {
  const matchups = teamData.matchups || [];
  const standingsMap = accumulateStandings(teamData, matchups);
  const tiebreakOrder = teamData.settings?.tiebreakOrder || DEFAULT_TIE_BREAK_ORDER;
  const rows = [...standingsMap.values()];
  const ranked = rankStandingsRows(rows, matchups, tiebreakOrder, teamData);

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

/**
 * Optional: standings sliced per group (uses group RR matchups when stage present).
 */
export function getGroupStandingsTables(teamData) {
  const groups = teamData?.groups || [];
  if (!groups.length) {
    return [
      {
        groupId: "",
        groupName: "Toàn giải",
        standing: getStandingsTable(teamData),
      },
    ];
  }

  return groups.map((group) => {
    const teamIdSet = new Set((group.teamIds || []).map(String));
    const matchups = (teamData.matchups || []).filter((matchup) => {
      if (String(matchup.stage || "") === "knockout") {
        return false;
      }
      if (matchup.groupId) {
        return String(matchup.groupId) === String(group.id);
      }
      return (
        teamIdSet.has(String(matchup.teamAId)) &&
        teamIdSet.has(String(matchup.teamBId))
      );
    });

    const subset = {
      ...teamData,
      teams: (teamData.teams || []).filter((team) => teamIdSet.has(String(team.id))),
      matchups,
    };
    return {
      groupId: group.id,
      groupName: group.name || group.id,
      standing: getStandingsTable(subset),
    };
  });
}
