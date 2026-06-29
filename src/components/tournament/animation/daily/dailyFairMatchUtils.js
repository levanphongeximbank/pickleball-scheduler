import { getCourtDisplayName } from "../../../../models/court.js";
import { MATCH_STATUS } from "../../../../models/tournament/constants.js";

export const DAILY_PLAYER_STATUS = {
  WAITING_CREATE: "waiting_create",
  CREATING: "creating",
  HAS_MATCH: "has_match",
  ON_COURT: "on_court",
  WAITING_NEXT: "waiting_next",
};

export const DAILY_PLAYER_STATUS_LABELS = {
  [DAILY_PLAYER_STATUS.WAITING_CREATE]: "Chờ tạo trận",
  [DAILY_PLAYER_STATUS.CREATING]: "Đang tạo trận",
  [DAILY_PLAYER_STATUS.HAS_MATCH]: "Đã có trận",
  [DAILY_PLAYER_STATUS.ON_COURT]: "Đã vào sân",
  [DAILY_PLAYER_STATUS.WAITING_NEXT]: "Chờ lượt tiếp theo",
};

export const DAILY_MATCH_DISPLAY_STATUS = {
  CREATING: "creating",
  WAITING_COURT: "waiting_court",
  ON_COURT: "on_court",
  NO_COURT: "no_court",
};

export const DAILY_MATCH_DISPLAY_LABELS = {
  [DAILY_MATCH_DISPLAY_STATUS.CREATING]: "Đang tạo",
  [DAILY_MATCH_DISPLAY_STATUS.WAITING_COURT]: "Chờ vào sân",
  [DAILY_MATCH_DISPLAY_STATUS.ON_COURT]: "Đã vào sân",
  [DAILY_MATCH_DISPLAY_STATUS.NO_COURT]: "Chưa xếp sân",
};

export const FAIR_MATCH_PHASES = {
  IDLE: "idle",
  ANALYZE: "analyze",
  TEAM_A: "team_a",
  TEAM_B: "team_b",
  VS: "vs",
  FAIRNESS: "fairness",
  COURT: "court",
  CONFIRM: "confirm",
  FLY: "fly",
  COMPLETE: "complete",
};

export const CREATION_FLOW_PHASES = [
  FAIR_MATCH_PHASES.ANALYZE,
  FAIR_MATCH_PHASES.TEAM_A,
  FAIR_MATCH_PHASES.TEAM_B,
  FAIR_MATCH_PHASES.VS,
  FAIR_MATCH_PHASES.FAIRNESS,
  FAIR_MATCH_PHASES.COURT,
  FAIR_MATCH_PHASES.CONFIRM,
  FAIR_MATCH_PHASES.FLY,
];

export function isActiveCreationPhase(phase = FAIR_MATCH_PHASES.IDLE) {
  return CREATION_FLOW_PHASES.includes(phase);
}

export function getPhaseStatusText(phase = FAIR_MATCH_PHASES.IDLE) {
  switch (phase) {
    case FAIR_MATCH_PHASES.ANALYZE:
      return "Đang phân tích người chơi...";
    case FAIR_MATCH_PHASES.TEAM_A:
      return "Công bố Team A";
    case FAIR_MATCH_PHASES.TEAM_B:
      return "Công bố Team B";
    case FAIR_MATCH_PHASES.VS:
      return "Đối đầu";
    case FAIR_MATCH_PHASES.FAIRNESS:
      return "Đang đánh giá độ cân bằng...";
    case FAIR_MATCH_PHASES.COURT:
      return "Xếp sân dự kiến";
    case FAIR_MATCH_PHASES.CONFIRM:
      return "Tạo trận thành công";
    case FAIR_MATCH_PHASES.FLY:
      return "Đang lưu trận vào danh sách";
    case FAIR_MATCH_PHASES.COMPLETE:
      return "Hoàn tất tạo trận";
    default:
      return "Sẵn sàng tạo trận";
  }
}

export function getCreationStepState(phase = FAIR_MATCH_PHASES.IDLE) {
  if (phase === FAIR_MATCH_PHASES.ANALYZE || phase === FAIR_MATCH_PHASES.TEAM_A || phase === FAIR_MATCH_PHASES.TEAM_B || phase === FAIR_MATCH_PHASES.VS) {
    return { analyze: "active", fairness: "pending", confirm: "pending" };
  }

  if (phase === FAIR_MATCH_PHASES.FAIRNESS) {
    return { analyze: "done", fairness: "active", confirm: "pending" };
  }

  if (
    phase === FAIR_MATCH_PHASES.COURT ||
    phase === FAIR_MATCH_PHASES.CONFIRM ||
    phase === FAIR_MATCH_PHASES.FLY
  ) {
    return { analyze: "done", fairness: "done", confirm: "active" };
  }

  if (phase === FAIR_MATCH_PHASES.COMPLETE) {
    return { analyze: "done", fairness: "done", confirm: "done" };
  }

  return { analyze: "pending", fairness: "pending", confirm: "pending" };
}

export function hasFairnessScore(match = {}) {
  return (
    match.diff != null ||
    (match.teamATotal != null && match.teamBTotal != null)
  );
}

export function getFairnessTier(percent) {
  if (percent == null || Number.isNaN(Number(percent))) {
    return { label: "Chưa đánh giá", tone: "neutral", sublabel: "" };
  }

  const score = Number(percent);

  if (score >= 90) {
    return { label: "Rất cân bằng", tone: "excellent", sublabel: "Excellent Match" };
  }

  if (score >= 80) {
    return { label: "Cân bằng tốt", tone: "good", sublabel: "Good Match" };
  }

  if (score >= 70) {
    return { label: "Chấp nhận được", tone: "fair", sublabel: "Fair Match" };
  }

  return { label: "Cần xem lại", tone: "warn", sublabel: "Review Match" };
}

function playersByIdMap(players = []) {
  return new Map(players.map((player) => [String(player.id), player]));
}

function buildTeamPlayers(playerIds = [], playersById) {
  return playerIds.map((playerId) => {
    const player = playersById.get(String(playerId));
    return {
      id: String(playerId),
      name: player?.name || String(playerId),
      rating: player?.rating ?? player?.level,
      gender: player?.gender,
    };
  });
}

export function computeDailyFairBalancePercent(match = {}) {
  const totalA = Number(match.teamATotal) || 0;
  const totalB = Number(match.teamBTotal) || 0;
  const maxTotal = Math.max(totalA, totalB, 0.001);
  const diff = Math.abs(Number(match.diff ?? totalA - totalB) || 0);
  return Math.round(Math.max(0, Math.min(100, 100 - (diff / maxTotal) * 100)));
}

export function resolveMatchCourtLabel(match = {}, courts = []) {
  if (!match.courtId) {
    return "Chưa xếp sân";
  }

  const court = courts.find((item) => String(item.id) === String(match.courtId));
  if (!court) {
    return "Chưa xếp sân";
  }

  const index = courts.findIndex((item) => String(item.id) === String(match.courtId));
  return getCourtDisplayName(court, index);
}

export function estimateMatchStartTime(baseDate = new Date(), matchIndex = 0, minutesPerMatch = 15) {
  const start = new Date(baseDate);
  start.setMinutes(start.getMinutes() + matchIndex * minutesPerMatch);
  return start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function estimateDailyPlayDurationMinutes(matchCount = 0, minutesPerMatch = 15) {
  return Math.max(0, matchCount) * minutesPerMatch;
}

export function countPlayerMatches(playerId, matches = []) {
  const key = String(playerId);
  return matches.filter((match) =>
    [...(match.teamAPlayerIds || []), ...(match.teamBPlayerIds || [])].includes(key)
  ).length;
}

export function getStepRevealPlayers(step = {}) {
  const teamA = step.teamA?.players || [];
  const teamB = step.teamB?.players || [];

  if (teamA.length || teamB.length) {
    return [...teamA, ...teamB];
  }

  const fallback = [step.left?.name, step.right?.name].filter(
    (name) => name && name !== "—"
  );

  return fallback.map((name, index) => ({
    id: `fallback-${index}`,
    name,
  }));
}

export function buildDailyFairMatchSteps(matches = [], players = [], courts = [], options = {}) {
  const playersById = playersByIdMap(players);
  const baseDate = options.baseDate ? new Date(options.baseDate) : new Date();
  const minutesPerMatch = Number(options.minutesPerMatch) || 15;

  return matches.map((match, index) => {
    const teamAPlayers = buildTeamPlayers(match.teamAPlayerIds || [], playersById);
    const teamBPlayers = buildTeamPlayers(match.teamBPlayerIds || [], playersById);

    return {
      index,
      matchId: match.id,
      matchLabel: `Trận ${String(index + 1).padStart(2, "0")}`,
      pairing: {
        id: match.id,
        name: `${match.teamALabel || "Team A"} vs ${match.teamBLabel || "Team B"}`,
      },
      team: {
        id: match.id,
        name: `${match.teamALabel || "Team A"} vs ${match.teamBLabel || "Team B"}`,
      },
      teamA: {
        label: match.teamALabel || "Team A",
        players: teamAPlayers,
      },
      teamB: {
        label: match.teamBLabel || "Team B",
        players: teamBPlayers,
      },
      left: {
        name: match.teamALabel || "Team A",
        players: teamAPlayers,
      },
      right: {
        name: match.teamBLabel || "Team B",
        players: teamBPlayers,
      },
      balancePercent: computeDailyFairBalancePercent(match),
      courtLabel: resolveMatchCourtLabel(match, courts),
      estimatedStartTime: estimateMatchStartTime(baseDate, index, minutesPerMatch),
      match,
      competitionType: match.competitionType || "doubles_mixed",
    };
  });
}

export function findPlayerMatchIndex(playerId, matches = []) {
  const key = String(playerId);
  return matches.findIndex((match) =>
    [...(match.teamAPlayerIds || []), ...(match.teamBPlayerIds || [])].includes(key)
  );
}

export function resolveDailyPlayerStatus(
  playerId,
  {
    matches = [],
    waitingPlayerIds = [],
    revealedCount = 0,
    currentMatchIndex = -1,
    phase = FAIR_MATCH_PHASES.IDLE,
  } = {}
) {
  const key = String(playerId);
  const waitingNext = new Set(waitingPlayerIds.map(String));

  if (waitingNext.has(key)) {
    return DAILY_PLAYER_STATUS.WAITING_NEXT;
  }

  const matchIndex = findPlayerMatchIndex(key, matches);
  if (matchIndex < 0) {
    return DAILY_PLAYER_STATUS.WAITING_CREATE;
  }

  const match = matches[matchIndex];
  const isRevealing =
    matchIndex === currentMatchIndex && isActiveCreationPhase(phase);

  if (isRevealing) {
    return DAILY_PLAYER_STATUS.CREATING;
  }

  if (matchIndex < revealedCount) {
    if (
      match.courtId &&
      (match.status === MATCH_STATUS.ASSIGNED || match.status === MATCH_STATUS.PLAYING)
    ) {
      return DAILY_PLAYER_STATUS.ON_COURT;
    }

    return DAILY_PLAYER_STATUS.HAS_MATCH;
  }

  return DAILY_PLAYER_STATUS.WAITING_CREATE;
}

export function buildDailyFairMatchPlayerPool({
  players = [],
  matches = [],
  waitingPlayers = [],
  existingMatches = [],
  revealedCount = 0,
  currentMatchIndex = -1,
  phase = FAIR_MATCH_PHASES.IDLE,
} = {}) {
  const waitingPlayerIds = waitingPlayers.map((player) =>
    String(typeof player === "object" ? player.id : player)
  );
  const poolIds = new Set();

  matches.forEach((match) => {
    [...(match.teamAPlayerIds || []), ...(match.teamBPlayerIds || [])].forEach((id) => {
      poolIds.add(String(id));
    });
  });

  waitingPlayerIds.forEach((id) => poolIds.add(id));

  return players
    .filter((player) => poolIds.has(String(player.id)))
    .map((player) => ({
      id: String(player.id),
      name: player.name,
      gender: player.gender,
      level: player.rating ?? player.level,
      matchesPlayed: countPlayerMatches(player.id, [...existingMatches, ...matches]),
      waitMinutes: null,
      status: resolveDailyPlayerStatus(player.id, {
        matches,
        waitingPlayerIds,
        revealedCount,
        currentMatchIndex,
        phase,
      }),
    }));
}

export function resolveDailyMatchDisplayStatus(match = {}, matchIndex = 0, revealedCount = 0) {
  if (matchIndex >= revealedCount) {
    return DAILY_MATCH_DISPLAY_STATUS.CREATING;
  }

  if (
    match.courtId &&
    (match.status === MATCH_STATUS.ASSIGNED || match.status === MATCH_STATUS.PLAYING)
  ) {
    return DAILY_MATCH_DISPLAY_STATUS.ON_COURT;
  }

  if (match.courtId) {
    return DAILY_MATCH_DISPLAY_STATUS.WAITING_COURT;
  }

  return DAILY_MATCH_DISPLAY_STATUS.NO_COURT;
}

export function buildDailyFairMatchAnimationPayload({
  result,
  players = [],
  courts = [],
  clubName = "CLB",
  playDate = new Date(),
  minutesPerMatch = 15,
} = {}) {
  const matches = result?.matches || [];
  const steps = buildDailyFairMatchSteps(matches, players, courts, {
    baseDate: playDate,
    minutesPerMatch,
  });

  const poolIds = new Set();
  matches.forEach((match) => {
    [...(match.teamAPlayerIds || []), ...(match.teamBPlayerIds || [])].forEach((id) => {
      poolIds.add(String(id));
    });
  });
  (result?.waitingPlayers || []).forEach((player) => {
    poolIds.add(String(typeof player === "object" ? player.id : player));
  });

  return {
    fairMatches: matches,
    steps,
    players: buildDailyFairMatchPlayerPool({
      players,
      matches,
      waitingPlayers: result?.waitingPlayers || [],
      revealedCount: 0,
      currentMatchIndex: -1,
      phase: FAIR_MATCH_PHASES.IDLE,
    }),
    waitingPlayers: result?.waitingPlayers || [],
    courts,
    clubName,
    playDate: playDate instanceof Date ? playDate.toISOString() : playDate,
    totalPlayers: poolIds.size,
    matchCount: matches.length,
    courtsInUse: matches.filter((match) => match.courtId).length,
    estimatedMinutes: estimateDailyPlayDurationMinutes(matches.length, minutesPerMatch),
  };
}

export function assertDailyFairMatchStepsMatchEngine(steps = [], engineMatches = []) {
  if (steps.length !== engineMatches.length) {
    throw new Error("Animation steps length must match engine matches length.");
  }

  steps.forEach((step, index) => {
    const engineMatch = engineMatches[index];
    if (String(step.matchId) !== String(engineMatch.id)) {
      throw new Error(`Match id mismatch at index ${index}.`);
    }

    if (JSON.stringify(step.match.teamAPlayerIds) !== JSON.stringify(engineMatch.teamAPlayerIds)) {
      throw new Error(`Team A mismatch at index ${index}.`);
    }

    if (JSON.stringify(step.match.teamBPlayerIds) !== JSON.stringify(engineMatch.teamBPlayerIds)) {
      throw new Error(`Team B mismatch at index ${index}.`);
    }
  });
}
