import { createId } from "../../../utils/id.js";
import {
  ACTIVATION_RULE,
  DREAMBREAKER_ORDER_SOURCE,
  DREAMBREAKER_STATUS,
  DISCIPLINE_KIND,
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../constants.js";
import {
  findMatchup,
  findTeam,
  normalizeTeamData,
} from "../models/index.js";
import {
  getDreambreakerDiscipline,
  isMlpFormat,
} from "./mlpPresetEngine.js";
import { computeMatchupTieProgress } from "./matchupTieEngine.js";
import { getRallyWinner, validateRallyScore } from "./rallyScoringEngine.js";

function shufflePlayerIds(playerIds = []) {
  const copy = [...playerIds];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function randomDreambreakerOrder(team) {
  const roster = team?.playerIds || [];
  if (roster.length < 4) {
    return [];
  }
  return shufflePlayerIds(roster).slice(0, 4);
}

function resolveDreambreakerOrderLockAt(matchup, teamData, now = new Date().toISOString()) {
  if (matchup?.scheduledAt) {
    return matchup.scheduledAt;
  }

  const leadMinutes = teamData.settings?.lineupLockLeadMinutes || 15;
  return new Date(new Date(now).getTime() + leadMinutes * 60000).toISOString();
}

function emptyDreambreaker() {
  return {
    status: DREAMBREAKER_STATUS.PENDING,
    teamAOrder: [],
    teamBOrder: [],
    teamAScore: 0,
    teamBScore: 0,
    winnerTeamId: "",
    orderLockAt: null,
    ordersLockedAt: null,
    orderSourceA: "",
    orderSourceB: "",
    rotation: {
      segmentIndex: 0,
      pointsInSegment: 0,
      pointHistory: [],
      injurySkips: [],
    },
    subMatchId: "",
  };
}

export function getActiveDreambreakerPlayers(matchup, teamData, teamSide) {
  const dreambreaker = matchup.dreambreaker;
  if (!dreambreaker) {
    return [];
  }

  const order =
    teamSide === "A" ? dreambreaker.teamAOrder : dreambreaker.teamBOrder;
  const segmentIndex = dreambreaker.rotation?.segmentIndex || 0;
  const playerId = order[segmentIndex % Math.max(order.length, 1)];

  if (!playerId) {
    return [];
  }

  const teamId = teamSide === "A" ? matchup.teamAId : matchup.teamBId;
  const team = findTeam(teamData, teamId);
  const player = team?.playerIds?.includes(playerId) ? playerId : null;

  return player ? [player] : [];
}

export function isDreambreakerReady(dreambreaker) {
  return (
    dreambreaker?.teamAOrder?.length === 4 && dreambreaker?.teamBOrder?.length === 4
  );
}

function resolveEffectiveOrder(order = [], injurySkips = [], teamId, segmentIndex) {
  const skipsForSegment = injurySkips.filter(
    (skip) => skip.teamId === teamId && skip.atSegment <= segmentIndex
  );
  const skippedIds = new Set(skipsForSegment.map((skip) => skip.skippedPlayerId));

  let attempts = 0;
  let index = segmentIndex % order.length;

  while (attempts < order.length) {
    const playerId = order[index];
    if (!skippedIds.has(playerId)) {
      return playerId;
    }
    index = (index + 1) % order.length;
    attempts += 1;
  }

  return order[segmentIndex % order.length] || "";
}

export function getDreambreakerCourtPlayers(matchup, teamData) {
  const dreambreaker = matchup.dreambreaker;
  if (!dreambreaker) {
    return { teamAPlayerId: "", teamBPlayerId: "" };
  }

  const segmentIndex = dreambreaker.rotation?.segmentIndex || 0;
  const injurySkips = dreambreaker.rotation?.injurySkips || [];

  return {
    teamAPlayerId: resolveEffectiveOrder(
      dreambreaker.teamAOrder,
      injurySkips,
      matchup.teamAId,
      segmentIndex
    ),
    teamBPlayerId: resolveEffectiveOrder(
      dreambreaker.teamBOrder,
      injurySkips,
      matchup.teamBId,
      segmentIndex
    ),
    segmentIndex,
    pointsInSegment: dreambreaker.rotation?.pointsInSegment || 0,
  };
}

export function maybeActivateDreambreaker(teamData, matchupId, now = new Date().toISOString()) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup || !isMlpFormat(teamData) || teamData.settings?.dreambreakerEnabled === false) {
    return { ok: true, teamData, activated: false };
  }

  const mainDisciplines = teamData.disciplines.filter(
    (discipline) => discipline.activationRule === ACTIVATION_RULE.ALWAYS
  );
  const mainSubMatches = matchup.subMatches.filter((subMatch) =>
    mainDisciplines.some((discipline) => discipline.id === subMatch.disciplineId)
  );

  const allMainDone = mainSubMatches.every(
    (subMatch) =>
      subMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      subMatch.status === SUB_MATCH_STATUS.FORFEIT
  );

  if (!allMainDone) {
    return { ok: true, teamData, activated: false };
  }

  let teamAWins = 0;
  let teamBWins = 0;
  mainSubMatches.forEach((subMatch) => {
    if (subMatch.winnerTeamId === matchup.teamAId) {
      teamAWins += 1;
    } else if (subMatch.winnerTeamId === matchup.teamBId) {
      teamBWins += 1;
    }
  });

  if (teamAWins === teamBWins && teamAWins === 2) {
    const dreambreakerDiscipline = getDreambreakerDiscipline(teamData.disciplines);
    const existing = matchup.dreambreaker || emptyDreambreaker();

    const nextMatchups = teamData.matchups.map((item) => {
      if (item.id !== matchupId) {
        return item;
      }

      return {
        ...item,
        dreambreaker: {
          ...existing,
          status:
            existing.status === DREAMBREAKER_STATUS.PENDING
              ? DREAMBREAKER_STATUS.LINEUP_OPEN
              : existing.status,
          orderLockAt: existing.orderLockAt || resolveDreambreakerOrderLockAt(item, teamData, now),
        },
        status:
          item.status === MATCHUP_STATUS.COMPLETED
            ? MATCHUP_STATUS.IN_PROGRESS
            : item.status,
      };
    });

    return {
      ok: true,
      teamData: normalizeTeamData({ ...teamData, matchups: nextMatchups }),
      activated: true,
      dreambreakerDiscipline,
    };
  }

  return { ok: true, teamData, activated: false };
}

export function submitDreambreakerOrder(teamData, { matchupId, teamId, order = [] }) {
  let nextData = teamData;
  let matchup = findMatchup(nextData, matchupId);

  if (!matchup?.dreambreaker) {
    const activation = maybeActivateDreambreaker(nextData, matchupId);
    nextData = activation.teamData;
    matchup = findMatchup(nextData, matchupId);
  }

  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  const dreambreaker = matchup.dreambreaker;
  if (
    !dreambreaker ||
    dreambreaker.status !== DREAMBREAKER_STATUS.LINEUP_OPEN
  ) {
    return { ok: false, error: "Dreambreaker chưa được kích hoạt." };
  }

  if (dreambreaker.ordersLockedAt) {
    return { ok: false, error: "Thứ tự Dreambreaker đã khóa." };
  }

  const team = findTeam(nextData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const normalizedOrder = order.map((id) => String(id).trim()).filter(Boolean);
  if (normalizedOrder.length !== 4) {
    return { ok: false, error: "Dreambreaker cần đúng 4 VĐV theo thứ tự 1→4." };
  }

  const unique = new Set(normalizedOrder);
  if (unique.size !== 4) {
    return { ok: false, error: "Thứ tự Dreambreaker không được trùng VĐV." };
  }

  const invalid = normalizedOrder.filter((playerId) => !team.playerIds.includes(playerId));
  if (invalid.length > 0) {
    return { ok: false, error: "Tất cả VĐV phải thuộc đội." };
  }

  const isTeamA = team.id === matchup.teamAId;
  const nextDreambreaker = {
    ...dreambreaker,
    teamAOrder: isTeamA ? normalizedOrder : dreambreaker.teamAOrder,
    teamBOrder: isTeamA ? dreambreaker.teamBOrder : normalizedOrder,
    orderSourceA: isTeamA ? DREAMBREAKER_ORDER_SOURCE.CAPTAIN : dreambreaker.orderSourceA,
    orderSourceB: isTeamA ? dreambreaker.orderSourceB : DREAMBREAKER_ORDER_SOURCE.CAPTAIN,
  };

  if (isDreambreakerReady(nextDreambreaker)) {
    nextDreambreaker.status = DREAMBREAKER_STATUS.READY;
  }

  const nextMatchups = nextData.matchups.map((item) =>
    item.id === matchupId ? { ...item, dreambreaker: nextDreambreaker } : item
  );

  return {
    ok: true,
    teamData: normalizeTeamData({ ...nextData, matchups: nextMatchups }),
    dreambreaker: nextDreambreaker,
  };
}

export function lockDreambreakerOrders(teamData, matchupId, { now = new Date().toISOString(), force = false } = {}) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup?.dreambreaker) {
    return { ok: false, error: "Dreambreaker chưa được kích hoạt." };
  }

  const dreambreaker = matchup.dreambreaker;
  if (
    ![DREAMBREAKER_STATUS.LINEUP_OPEN, DREAMBREAKER_STATUS.READY].includes(
      dreambreaker.status
    )
  ) {
    return { ok: true, teamData, logs: [] };
  }

  const pastDeadline =
    force ||
    (dreambreaker.orderLockAt &&
      new Date(now).getTime() >= new Date(dreambreaker.orderLockAt).getTime());

  if (!pastDeadline) {
    return { ok: true, teamData, logs: [] };
  }

  const teamA = findTeam(teamData, matchup.teamAId);
  const teamB = findTeam(teamData, matchup.teamBId);
  const logs = [];
  let nextDreambreaker = { ...dreambreaker };

  if (force) {
    nextDreambreaker.ordersLockedAt = nextDreambreaker.ordersLockedAt || now;
  }

  if (nextDreambreaker.teamAOrder.length !== 4 && teamA) {
    const order = randomDreambreakerOrder(teamA);
    if (order.length === 4) {
      nextDreambreaker = {
        ...nextDreambreaker,
        teamAOrder: order,
        orderSourceA: DREAMBREAKER_ORDER_SOURCE.RANDOM,
      };
      logs.push(`Tự động sắp xếp thứ tự Dreambreaker cho ${teamA.name}.`);
    }
  }

  if (nextDreambreaker.teamBOrder.length !== 4 && teamB) {
    const order = randomDreambreakerOrder(teamB);
    if (order.length === 4) {
      nextDreambreaker = {
        ...nextDreambreaker,
        teamBOrder: order,
        orderSourceB: DREAMBREAKER_ORDER_SOURCE.RANDOM,
      };
      logs.push(`Tự động sắp xếp thứ tự Dreambreaker cho ${teamB.name}.`);
    }
  }

  if (force || logs.length > 0) {
    nextDreambreaker.ordersLockedAt = nextDreambreaker.ordersLockedAt || now;
  }

  if (isDreambreakerReady(nextDreambreaker)) {
    nextDreambreaker.status = DREAMBREAKER_STATUS.READY;
  }

  const nextMatchups = teamData.matchups.map((item) =>
    item.id === matchupId ? { ...item, dreambreaker: nextDreambreaker } : item
  );

  const nextTeamData = normalizeTeamData({ ...teamData, matchups: nextMatchups });

  if (force && !isDreambreakerReady(nextDreambreaker)) {
    return {
      ok: false,
      error: "Không thể khóa thứ tự Dreambreaker — đội thiếu VĐV trên roster.",
      teamData: nextTeamData,
      dreambreaker: nextDreambreaker,
      logs,
    };
  }

  return {
    ok: true,
    teamData: nextTeamData,
    dreambreaker: nextDreambreaker,
    logs,
  };
}

export function syncDreambreakerForAllMatchups(teamData, { now = new Date().toISOString() } = {}) {
  let nextData = teamData;
  let changed = false;

  for (const matchup of teamData.matchups || []) {
    const progress = computeMatchupTieProgress(nextData, matchup);
    if (progress.needsDreambreaker) {
      const activation = maybeActivateDreambreaker(nextData, matchup.id, now);
      if (activation.activated) {
        changed = true;
        nextData = activation.teamData;
      }
    }
  }

  for (const matchup of nextData.matchups || []) {
    if (!matchup.dreambreaker) {
      continue;
    }

    const lockResult = lockDreambreakerOrders(nextData, matchup.id, { now });
    if (lockResult.logs?.length > 0) {
      changed = true;
      nextData = lockResult.teamData;
    }
  }

  return {
    ok: true,
    teamData: normalizeTeamData(nextData),
    changed,
  };
}

export function listDreambreakerMatchups(teamData, { teamId } = {}) {
  return (teamData.matchups || []).filter((matchup) => {
    if (teamId && matchup.teamAId !== teamId && matchup.teamBId !== teamId) {
      return false;
    }

    const progress = computeMatchupTieProgress(teamData, matchup);
    if (!progress.dreambreakerEnabled) {
      return false;
    }

    if (progress.needsDreambreaker) {
      return true;
    }

    const status = matchup.dreambreaker?.status;
    return [
      DREAMBREAKER_STATUS.LINEUP_OPEN,
      DREAMBREAKER_STATUS.READY,
      DREAMBREAKER_STATUS.IN_PROGRESS,
      DREAMBREAKER_STATUS.COMPLETED,
    ].includes(status);
  });
}

export function startDreambreaker(teamData, matchupId, options = {}) {
  const locked = lockDreambreakerOrders(teamData, matchupId, {
    now: options.now,
    force: options.forceLock,
  });
  if (!locked.ok) {
    return locked;
  }

  const matchup = findMatchup(locked.teamData, matchupId);
  if (!matchup?.dreambreaker) {
    return { ok: false, error: "Dreambreaker chưa sẵn sàng." };
  }

  if (!isDreambreakerReady(matchup.dreambreaker)) {
    return { ok: false, error: "Hai đội phải nộp thứ tự 4 VĐV trước." };
  }

  const dreambreakerDiscipline = getDreambreakerDiscipline(locked.teamData.disciplines);
  if (!dreambreakerDiscipline) {
    return { ok: false, error: "Thiếu nội dung Dreambreaker." };
  }

  let subMatchId = matchup.dreambreaker.subMatchId;
  let subMatches = [...matchup.subMatches];

  if (!subMatchId) {
    subMatchId = createId("sub");
    subMatches = [
      ...subMatches,
      {
        id: subMatchId,
        disciplineId: dreambreakerDiscipline.id,
        sortOrder: dreambreakerDiscipline.sortOrder,
        status: SUB_MATCH_STATUS.PLAYING,
        score: { teamA: 0, teamB: 0, games: [] },
        winnerTeamId: "",
      },
    ];
  }

  const nextMatchups = teamData.matchups.map((item) => {
    if (item.id !== matchupId) {
      return item;
    }

    return {
      ...item,
      subMatches,
      status: MATCHUP_STATUS.IN_PROGRESS,
      dreambreaker: {
        ...item.dreambreaker,
        status: DREAMBREAKER_STATUS.IN_PROGRESS,
        subMatchId,
        teamAScore: 0,
        teamBScore: 0,
        rotation: {
          segmentIndex: 0,
          pointsInSegment: 0,
          pointHistory: [],
          injurySkips: item.dreambreaker.rotation?.injurySkips || [],
        },
      },
    };
  });

  return {
    ok: true,
    teamData: normalizeTeamData({ ...locked.teamData, matchups: nextMatchups }),
  };
}

export function recordDreambreakerPoint(teamData, { matchupId, scoringTeamId }) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup?.dreambreaker || matchup.dreambreaker.status !== DREAMBREAKER_STATUS.IN_PROGRESS) {
    return { ok: false, error: "Dreambreaker chưa bắt đầu." };
  }

  const dreambreakerDiscipline = getDreambreakerDiscipline(teamData.disciplines);
  const rotationPoints = dreambreakerDiscipline?.scoringFormat?.rotationPoints || 4;

  if (scoringTeamId !== matchup.teamAId && scoringTeamId !== matchup.teamBId) {
    return { ok: false, error: "Đội ghi điểm không hợp lệ." };
  }

  const isTeamA = scoringTeamId === matchup.teamAId;
  const teamAScore = matchup.dreambreaker.teamAScore + (isTeamA ? 1 : 0);
  const teamBScore = matchup.dreambreaker.teamBScore + (isTeamA ? 0 : 1);
  let pointsInSegment = (matchup.dreambreaker.rotation?.pointsInSegment || 0) + 1;
  let segmentIndex = matchup.dreambreaker.rotation?.segmentIndex || 0;

  const pointHistory = [
    ...(matchup.dreambreaker.rotation?.pointHistory || []),
    {
      teamId: scoringTeamId,
      segmentIndex,
      teamAScore,
      teamBScore,
    },
  ];

  if (pointsInSegment >= rotationPoints) {
    segmentIndex += 1;
    pointsInSegment = 0;
  }

  const rules = dreambreakerDiscipline?.scoringFormat || {};
  const winnerSide = getRallyWinner(teamAScore, teamBScore, rules);
  const winnerTeamId =
    winnerSide === "teamA"
      ? matchup.teamAId
      : winnerSide === "teamB"
        ? matchup.teamBId
        : "";

  const nextDreambreaker = {
    ...matchup.dreambreaker,
    teamAScore,
    teamBScore,
    winnerTeamId,
    status: winnerTeamId ? DREAMBREAKER_STATUS.COMPLETED : DREAMBREAKER_STATUS.IN_PROGRESS,
    rotation: {
      ...matchup.dreambreaker.rotation,
      segmentIndex,
      pointsInSegment,
      pointHistory,
    },
  };

  const nextSubMatches = matchup.subMatches.map((subMatch) => {
    if (subMatch.id !== matchup.dreambreaker.subMatchId) {
      return subMatch;
    }

    return {
      ...subMatch,
      status: winnerTeamId ? SUB_MATCH_STATUS.COMPLETED : SUB_MATCH_STATUS.PLAYING,
      score: { teamA: teamAScore, teamB: teamBScore, games: [] },
      winnerTeamId,
      resultConfirmedAt: winnerTeamId ? new Date().toISOString() : null,
    };
  });

  const nextMatchups = teamData.matchups.map((item) =>
    item.id === matchupId
      ? {
          ...item,
          subMatches: nextSubMatches,
          dreambreaker: nextDreambreaker,
          status: winnerTeamId ? MATCHUP_STATUS.COMPLETED : item.status,
          result: winnerTeamId
            ? {
                teamAWins: 2 + (winnerTeamId === matchup.teamAId ? 1 : 0),
                teamBWins: 2 + (winnerTeamId === matchup.teamBId ? 1 : 0),
                teamAPoints: teamAScore,
                teamBPoints: teamBScore,
                winnerTeamId,
              }
            : item.result,
        }
      : item
  );

  return {
    ok: true,
    teamData: normalizeTeamData({ ...teamData, matchups: nextMatchups }),
    completed: Boolean(winnerTeamId),
    winnerTeamId,
  };
}

export function undoDreambreakerPoint(teamData, matchupId) {
  const matchup = findMatchup(teamData, matchupId);
  const history = matchup?.dreambreaker?.rotation?.pointHistory || [];
  if (!matchup?.dreambreaker || history.length === 0) {
    return { ok: false, error: "Không có điểm để hoàn tác." };
  }

  const remaining = history.slice(0, -1);
  const last = remaining[remaining.length - 1];
  const teamAScore = last?.teamAScore || 0;
  const teamBScore = last?.teamBScore || 0;

  let segmentIndex = 0;
  let pointsInSegment = 0;
  if (remaining.length > 0) {
    const tail = remaining[remaining.length - 1];
    segmentIndex = tail.segmentIndex;
    pointsInSegment = remaining.filter((entry) => entry.segmentIndex === segmentIndex).length;
    const rotationPoints =
      getDreambreakerDiscipline(teamData.disciplines)?.scoringFormat?.rotationPoints || 4;
    if (pointsInSegment >= rotationPoints) {
      segmentIndex += 1;
      pointsInSegment = 0;
    }
  }

  const nextDreambreaker = {
    ...matchup.dreambreaker,
    teamAScore,
    teamBScore,
    winnerTeamId: "",
    status: DREAMBREAKER_STATUS.IN_PROGRESS,
    rotation: {
      ...matchup.dreambreaker.rotation,
      segmentIndex,
      pointsInSegment,
      pointHistory: remaining,
    },
  };

  const nextMatchups = teamData.matchups.map((item) =>
    item.id === matchupId
      ? {
          ...item,
          dreambreaker: nextDreambreaker,
          status: MATCHUP_STATUS.IN_PROGRESS,
          result: item.result
            ? { ...item.result, winnerTeamId: "" }
            : item.result,
        }
      : item
  );

  return {
    ok: true,
    teamData: normalizeTeamData({ ...teamData, matchups: nextMatchups }),
  };
}

export function validateDreambreakerFinalScore(teamData, matchupId) {
  const matchup = findMatchup(teamData, matchupId);
  const dreambreaker = matchup?.dreambreaker;
  if (!dreambreaker) {
    return { ok: false, error: "Không có Dreambreaker." };
  }

  const discipline = getDreambreakerDiscipline(teamData.disciplines);
  return validateRallyScore({
    scoreA: dreambreaker.teamAScore,
    scoreB: dreambreaker.teamBScore,
    rules: discipline?.scoringFormat,
  });
}
