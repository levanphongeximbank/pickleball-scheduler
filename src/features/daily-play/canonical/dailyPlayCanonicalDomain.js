/**
 * Pure Daily Play canonical domain helpers.
 * Client pairing engines may propose; these enforce invariants before persist.
 */

import {
  appendScoreLogToMatch,
  createScoreLogEntry,
  SCORE_LOG_ACTION,
  SCORE_LOG_SOURCE,
} from "../../../models/tournament/scoreLog.js";
import {
  DAILY_PLAY_ACTIVE_MATCH_STATUSES,
  DAILY_PLAY_CODE,
  DAILY_PLAY_LEASE_ACTIVE,
  DAILY_PLAY_LEASE_RELEASED,
  DAILY_PLAY_MESSAGES,
} from "./dailyPlayCodes.js";

export function emptyDailyPlayState() {
  return {
    revision: 0,
    checkedInPlayerIds: [],
    matchType: "mixed_double",
    genderFilter: "all",
    enabledCourtIds: [],
    matches: [],
    skipScore: false,
  };
}

export function normalizeDailyPlayCanonicalState(raw = {}) {
  const base = emptyDailyPlayState();
  return {
    ...base,
    ...raw,
    revision: Number.isFinite(Number(raw.revision)) ? Number(raw.revision) : 0,
    checkedInPlayerIds: Array.isArray(raw.checkedInPlayerIds)
      ? raw.checkedInPlayerIds.map(String)
      : [],
    enabledCourtIds: Array.isArray(raw.enabledCourtIds)
      ? raw.enabledCourtIds.map(String)
      : [],
    matches: Array.isArray(raw.matches) ? raw.matches.map(normalizeMatch) : [],
    skipScore: raw.skipScore === true,
  };
}

function normalizeMatch(match = {}) {
  return {
    ...match,
    id: String(match.id || ""),
    status: String(match.status || "waiting"),
    courtId: match.courtId == null || match.courtId === "" ? null : String(match.courtId),
    teamAPlayerIds: Array.isArray(match.teamAPlayerIds)
      ? match.teamAPlayerIds.map(String)
      : [],
    teamBPlayerIds: Array.isArray(match.teamBPlayerIds)
      ? match.teamBPlayerIds.map(String)
      : [],
    scoreA: match.scoreA == null ? null : Number(match.scoreA),
    scoreB: match.scoreB == null ? null : Number(match.scoreB),
  };
}

export function normalizeCanonicalCourt(court = {}, index = 0) {
  const id = String(court.id ?? index + 1);
  const status = String(court.status || (court.active === false ? "inactive" : "active"));
  const active = court.active !== false && status !== "inactive";
  const operational = status === "locked" || status === "maintenance" ? status : "active";
  return {
    id,
    name: String(court.name || court.displayName || `Sân ${index + 1}`),
    number: court.number ?? index + 1,
    active,
    status: operational,
    venueId: court.venueId || null,
    clubId: court.clubId || null,
    clusterId: court.clusterId || null,
  };
}

export function selectEnabledCourts(courts = [], enabledCourtIds = []) {
  const normalized = (courts || []).map((court, index) =>
    normalizeCanonicalCourt(court, index)
  );
  const usable = normalized.filter(
    (court) =>
      court.active &&
      court.status !== "locked" &&
      court.status !== "maintenance"
  );
  if (!enabledCourtIds?.length) {
    return usable;
  }
  const allow = new Set(enabledCourtIds.map(String));
  return usable.filter((court) => allow.has(String(court.id)));
}

export function getBusyPlayerIds(matches = []) {
  const busy = new Set();
  const active = new Set(DAILY_PLAY_ACTIVE_MATCH_STATUSES);
  for (const match of matches || []) {
    if (!active.has(String(match.status))) continue;
    for (const id of [...(match.teamAPlayerIds || []), ...(match.teamBPlayerIds || [])]) {
      busy.add(String(id));
    }
  }
  return busy;
}

export function getActiveLeaseCourtIds(leases = []) {
  return new Set(
    (leases || [])
      .filter((lease) => String(lease.status) === DAILY_PLAY_LEASE_ACTIVE)
      .map((lease) => String(lease.courtId))
  );
}

export function getOccupiedCourtIdsFromMatches(matches = []) {
  const occupied = new Set();
  for (const match of matches || []) {
    if (
      (match.status === "assigned" || match.status === "playing") &&
      match.courtId != null &&
      match.courtId !== ""
    ) {
      occupied.add(String(match.courtId));
    }
  }
  return occupied;
}

export function validateDoublesMatchShape(match = {}) {
  const teamA = Array.isArray(match.teamAPlayerIds)
    ? match.teamAPlayerIds.map(String)
    : [];
  const teamB = Array.isArray(match.teamBPlayerIds)
    ? match.teamBPlayerIds.map(String)
    : [];
  const players = [
    ...(match.playerIds || []),
    ...teamA,
    ...teamB,
  ].map(String);
  const distinct = [...new Set(players)];

  if (teamA.length || teamB.length) {
    if (teamA.length !== 2 || teamB.length !== 2) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.INVALID_MATCH_SHAPE,
        error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_SHAPE],
      };
    }
  }

  if (distinct.length !== 4) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.INVALID_MATCH_SHAPE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_SHAPE],
    };
  }

  return { ok: true, playerIds: distinct };
}

export function listAvailableCourts({ courts = [], matches = [], leases = [] } = {}) {
  const leased = getActiveLeaseCourtIds(leases);
  const occupied = getOccupiedCourtIdsFromMatches(matches);
  return (courts || []).filter((court) => {
    const id = String(court.id);
    return !leased.has(id) && !occupied.has(id);
  });
}

export function assertExpectedVersion(state, expectedVersion) {
  if (expectedVersion == null || !Number.isFinite(Number(expectedVersion))) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.MISSING_EXPECTED_VERSION,
      error: "Thiếu expectedVersion.",
    };
  }
  if (Number(state.revision) !== Number(expectedVersion)) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.VERSION_CONFLICT,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.VERSION_CONFLICT],
      expectedVersion: Number(expectedVersion),
      actualVersion: Number(state.revision),
    };
  }
  return { ok: true };
}

export function bumpRevision(state) {
  return {
    ...state,
    revision: Number(state.revision || 0) + 1,
  };
}

export function validateProposedMatchPlayers(match, { checkedInPlayerIds, matches }) {
  const shape = validateDoublesMatchShape(match);
  if (!shape.ok) return shape;

  const checked = new Set((checkedInPlayerIds || []).map(String));
  const busy = getBusyPlayerIds(matches);
  const players = shape.playerIds;

  for (const playerId of players) {
    if (!checked.has(playerId)) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.VALIDATION,
        error: `VĐV ${playerId} chưa check-in.`,
      };
    }
    if (busy.has(playerId)) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.PLAYER_ALREADY_ACTIVE,
        error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.PLAYER_ALREADY_ACTIVE],
        playerId,
      };
    }
  }

  return { ok: true, playerIds: players };
}

export function assertMatchParticipantsReady(
  match,
  { checkedInPlayerIds = [], isEligible = () => true } = {}
) {
  const shape = validateDoublesMatchShape(match);
  if (!shape.ok) return shape;
  const checked = new Set((checkedInPlayerIds || []).map(String));
  for (const playerId of shape.playerIds) {
    if (!checked.has(playerId)) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.VALIDATION,
        error: `VĐV ${playerId} chưa check-in.`,
      };
    }
    if (!isEligible(playerId)) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE,
        error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE],
        playerId,
      };
    }
  }
  return { ok: true, playerIds: shape.playerIds };
}

export function resolveCreateMatchCount({
  enabledCourts = [],
  availableCourts = [],
  eligiblePlayerCount = 0,
} = {}) {
  if (!enabledCourts.length) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.NO_COURT_CAPABILITY,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_CAPABILITY],
      matchCount: 0,
      waitingForCourt: false,
    };
  }

  const capacity = Math.floor(Number(eligiblePlayerCount) / 4);
  if (capacity < 1) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.NOT_ENOUGH_PLAYERS,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NOT_ENOUGH_PLAYERS],
      matchCount: 0,
      waitingForCourt: false,
    };
  }

  const free = availableCourts.length;
  if (free > 0) {
    return {
      ok: true,
      matchCount: Math.min(free, capacity),
      waitingForCourt: false,
    };
  }

  // Courts exist but all occupied — waiting matches allowed.
  return {
    ok: true,
    matchCount: capacity,
    waitingForCourt: true,
    message: DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING,
  };
}

export function acceptDailyScoreFieldInput(raw) {
  if (raw == null || raw === "") return "";
  const text = String(raw);
  if (!/^\d*$/.test(text)) return null;
  return text;
}

export function parseNonNegativeIntegerScore(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || !Number.isFinite(value)) {
      return { ok: false };
    }
    return { ok: true, value };
  }
  if (value == null) return { ok: false };
  const text = String(value).trim();
  if (text === "" || !/^\d+$/.test(text)) return { ok: false };
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 0) return { ok: false };
  return { ok: true, value: parsed };
}

export function validateScoreInput(scoreA, scoreB) {
  const parsedA = parseNonNegativeIntegerScore(scoreA);
  const parsedB = parseNonNegativeIntegerScore(scoreB);
  if (!parsedA.ok || !parsedB.ok) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.INVALID_SCORE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_SCORE],
    };
  }
  const a = parsedA.value;
  const b = parsedB.value;
  if (a === b) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.INVALID_SCORE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_SCORE],
    };
  }
  return { ok: true, scoreA: a, scoreB: b, winnerSide: a > b ? "A" : "B" };
}

export function applyCheckIn(state, playerId) {
  const next = normalizeDailyPlayCanonicalState(state);
  const key = String(playerId);
  if (!next.checkedInPlayerIds.includes(key)) {
    next.checkedInPlayerIds = [...next.checkedInPlayerIds, key];
  }
  return bumpRevision(next);
}

export function applyCheckOut(state, playerId) {
  const next = normalizeDailyPlayCanonicalState(state);
  const key = String(playerId);
  const busy = getBusyPlayerIds(next.matches);
  if (busy.has(key)) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.CHECKOUT_PLAYER_ACTIVE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.CHECKOUT_PLAYER_ACTIVE],
    };
  }
  next.checkedInPlayerIds = next.checkedInPlayerIds.filter((id) => id !== key);
  return { ok: true, state: bumpRevision(next) };
}

export function applyCreateMatches(state, proposedMatches = []) {
  let next = normalizeDailyPlayCanonicalState(state);
  const created = [];

  for (const proposed of proposedMatches) {
    const validation = validateProposedMatchPlayers(proposed, next);
    if (!validation.ok) {
      return validation;
    }
    const match = normalizeMatch({
      ...proposed,
      id: String(proposed.id || `daily-match-${Date.now()}-${created.length + 1}`),
      status: "waiting",
      courtId: null,
      scoreA: null,
      scoreB: null,
      createdAt: proposed.createdAt || new Date().toISOString(),
    });
    next = {
      ...next,
      matches: [...next.matches, match],
    };
    created.push(match);
  }

  if (!created.length) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.VALIDATION,
      error: "Không có trận hợp lệ để tạo.",
    };
  }

  return { ok: true, state: bumpRevision(next), matches: created };
}

export function applyAssignCourt(state, { matchId, courtId, leases = [] }) {
  const next = normalizeDailyPlayCanonicalState(state);
  const match = next.matches.find((item) => item.id === String(matchId));
  if (!match) {
    return { ok: false, code: DAILY_PLAY_CODE.NOT_FOUND, error: "Không tìm thấy trận." };
  }
  if (match.status !== "waiting") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.MATCH_NOT_WAITING,
      error: "Chỉ xếp sân cho trận đang chờ (waiting).",
    };
  }

  const courtKey = String(courtId);
  const leased = getActiveLeaseCourtIds(leases);
  const occupied = getOccupiedCourtIdsFromMatches(next.matches);
  if (leased.has(courtKey) || occupied.has(courtKey)) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.COURT_ALREADY_LEASED,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.COURT_ALREADY_LEASED],
    };
  }

  const matches = next.matches.map((item) =>
    item.id === match.id
      ? {
          ...item,
          courtId: courtKey,
          status: "assigned",
          assignedAt: new Date().toISOString(),
        }
      : item
  );

  const lease = {
    id: `lease-${match.id}`,
    matchId: match.id,
    courtId: courtKey,
    status: DAILY_PLAY_LEASE_ACTIVE,
    leasedAt: new Date().toISOString(),
    releasedAt: null,
  };

  return {
    ok: true,
    state: bumpRevision({ ...next, matches }),
    lease,
    matchId: match.id,
    courtId: courtKey,
  };
}

export function applyStartMatch(state, { matchId, leases = [] }) {
  const next = normalizeDailyPlayCanonicalState(state);
  const match = next.matches.find((item) => item.id === String(matchId));
  if (!match) {
    return { ok: false, code: DAILY_PLAY_CODE.NOT_FOUND, error: "Không tìm thấy trận." };
  }
  if (match.status !== "assigned") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.MATCH_NOT_ASSIGNED,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.MATCH_NOT_ASSIGNED],
    };
  }
  if (!match.courtId) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.VALIDATION,
      error: "Trận assigned phải có sân trước khi bắt đầu.",
    };
  }

  const hasLease = (leases || []).some(
    (lease) =>
      String(lease.matchId) === String(matchId) &&
      String(lease.courtId) === String(match.courtId) &&
      String(lease.status) === DAILY_PLAY_LEASE_ACTIVE
  );
  if (!hasLease) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.VALIDATION,
      error: "Thiếu lease sân active cho trận assigned.",
    };
  }

  const matches = next.matches.map((item) =>
    item.id === match.id
      ? {
          ...item,
          status: "playing",
          startedAt: new Date().toISOString(),
        }
      : item
  );

  return {
    ok: true,
    state: bumpRevision({ ...next, matches }),
    matchId: match.id,
    courtId: match.courtId,
  };
}

export function applySubmitScore(state, { matchId, scoreA, scoreB, leases = [] }) {
  const next = normalizeDailyPlayCanonicalState(state);
  const index = next.matches.findIndex((item) => item.id === String(matchId));
  if (index < 0) {
    return { ok: false, code: DAILY_PLAY_CODE.NOT_FOUND, error: "Không tìm thấy trận." };
  }

  const current = next.matches[index];
  const score = validateScoreInput(scoreA, scoreB);
  if (!score.ok) return score;

  if (current.status === "completed" || current.status === "forfeit") {
    if (
      Number(current.scoreA) === score.scoreA &&
      Number(current.scoreB) === score.scoreB
    ) {
      return {
        ok: true,
        replay: true,
        state: next,
        match: current,
        releasedCourtId: null,
        leases,
      };
    }
    return {
      ok: false,
      code: DAILY_PLAY_CODE.SCORE_CONFLICT,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.SCORE_CONFLICT],
    };
  }

  if (current.status !== "playing") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.MATCH_NOT_PLAYING,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.MATCH_NOT_PLAYING],
    };
  }

  const completed = {
    ...current,
    scoreA: score.scoreA,
    scoreB: score.scoreB,
    status: "completed",
    winnerSide: score.winnerSide,
    completedAt: new Date().toISOString(),
  };

  const matches = [...next.matches];
  matches[index] = completed;

  const releasedCourtId = current.courtId;
  const nextLeases = (leases || []).map((lease) => {
    if (
      String(lease.matchId) === String(matchId) &&
      String(lease.status) === DAILY_PLAY_LEASE_ACTIVE
    ) {
      return {
        ...lease,
        status: DAILY_PLAY_LEASE_RELEASED,
        releasedAt: new Date().toISOString(),
      };
    }
    return lease;
  });

  return {
    ok: true,
    state: bumpRevision({ ...next, matches }),
    match: completed,
    releasedCourtId,
    leases: nextLeases,
  };
}

function appendCorrectionScoreLog(match, { oldScoreA, oldScoreB, scoreA, scoreB, note }) {
  let next = match;
  if (!Array.isArray(next.scoreLog) || next.scoreLog.length === 0) {
    next = appendScoreLogToMatch(
      next,
      createScoreLogEntry({
        source: SCORE_LOG_SOURCE.DIRECTOR,
        action: SCORE_LOG_ACTION.FINALIZED,
        actorName: "Hệ thống",
        matchId: next.id,
        oldScoreA: 0,
        oldScoreB: 0,
        scoreA: oldScoreA,
        scoreB: oldScoreB,
        note: "Điểm gốc khi hoàn tất",
      })
    );
  }
  return appendScoreLogToMatch(
    next,
    createScoreLogEntry({
      source: SCORE_LOG_SOURCE.DIRECTOR,
      action: SCORE_LOG_ACTION.ADMIN_OVERRIDE,
      actorName: "BTC",
      matchId: next.id,
      oldScoreA,
      oldScoreB,
      scoreA,
      scoreB,
      note: note || "Sửa điểm trận đã hoàn tất",
    })
  );
}

export function applyCorrectScore(state, { matchId, scoreA, scoreB, note = "", leases = [] }) {
  const next = normalizeDailyPlayCanonicalState(state);
  const index = next.matches.findIndex((item) => item.id === String(matchId));
  if (index < 0) {
    return { ok: false, code: DAILY_PLAY_CODE.NOT_FOUND, error: "Không tìm thấy trận." };
  }

  const current = next.matches[index];
  const score = validateScoreInput(scoreA, scoreB);
  if (!score.ok) return score;

  if (current.status !== "completed") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.MATCH_NOT_COMPLETED,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.MATCH_NOT_COMPLETED],
    };
  }

  if (Number(current.scoreA) === score.scoreA && Number(current.scoreB) === score.scoreB) {
    return {
      ok: true,
      replay: true,
      state: next,
      match: current,
      leases,
      ratingVprApplied: false,
    };
  }

  const corrected = appendCorrectionScoreLog(
    {
      ...current,
      scoreA: score.scoreA,
      scoreB: score.scoreB,
      winner: score.winnerSide,
      winnerSide: score.winnerSide,
      status: "completed",
      correctedAt: new Date().toISOString(),
    },
    {
      oldScoreA: Number(current.scoreA),
      oldScoreB: Number(current.scoreB),
      scoreA: score.scoreA,
      scoreB: score.scoreB,
      note,
    }
  );

  const matches = [...next.matches];
  matches[index] = corrected;

  return {
    ok: true,
    state: bumpRevision({ ...next, matches }),
    match: corrected,
    leases,
    ratingVprApplied: false,
  };
}

export function applyCancelMatch(state, { matchId, leases = [] }) {
  const next = normalizeDailyPlayCanonicalState(state);
  const index = next.matches.findIndex((item) => item.id === String(matchId));
  if (index < 0) {
    return { ok: false, code: DAILY_PLAY_CODE.NOT_FOUND, error: "Không tìm thấy trận." };
  }
  const current = next.matches[index];
  if (current.status === "completed" || current.status === "forfeit") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.MATCH_COMPLETED_IMMUTABLE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.MATCH_COMPLETED_IMMUTABLE],
    };
  }
  if (!DAILY_PLAY_ACTIVE_MATCH_STATUSES.includes(current.status)) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.VALIDATION,
      error: "Không hủy được trận ở trạng thái hiện tại.",
    };
  }

  const matches = next.matches.map((item, idx) =>
    idx === index
      ? {
          ...item,
          status: "cancelled",
          courtId: null,
          cancelledAt: new Date().toISOString(),
        }
      : item
  );

  const nextLeases = (leases || []).map((lease) => {
    if (
      String(lease.matchId) === String(matchId) &&
      String(lease.status) === DAILY_PLAY_LEASE_ACTIVE
    ) {
      return {
        ...lease,
        status: DAILY_PLAY_LEASE_RELEASED,
        releasedAt: new Date().toISOString(),
      };
    }
    return lease;
  });

  return {
    ok: true,
    state: bumpRevision({ ...next, matches }),
    releasedCourtId: current.courtId || null,
    leases: nextLeases,
  };
}

export function applyChangeCourt(state, { matchId, newCourtId, leases = [] }) {
  const next = normalizeDailyPlayCanonicalState(state);
  const match = next.matches.find((item) => item.id === String(matchId));
  if (!match) {
    return { ok: false, code: DAILY_PLAY_CODE.NOT_FOUND, error: "Không tìm thấy trận." };
  }
  if (match.status !== "playing" && match.status !== "assigned") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.MATCH_NOT_ACTIVE,
      error: "Chỉ đổi sân cho trận assigned hoặc playing.",
    };
  }

  const target = String(newCourtId);
  if (String(match.courtId) === target) {
    return { ok: true, replay: true, state: next, leases, courtId: target };
  }

  const leased = getActiveLeaseCourtIds(
    (leases || []).filter((lease) => String(lease.matchId) !== String(matchId))
  );
  const occupied = getOccupiedCourtIdsFromMatches(
    next.matches.filter((item) => item.id !== match.id)
  );
  if (leased.has(target) || occupied.has(target)) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.COURT_ALREADY_LEASED,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.COURT_ALREADY_LEASED],
    };
  }

  const preservedStatus = match.status;
  const matches = next.matches.map((item) =>
    item.id === match.id ? { ...item, courtId: target, status: preservedStatus } : item
  );

  let foundActive = false;
  const nextLeases = (leases || []).map((lease) => {
    if (
      String(lease.matchId) === String(matchId) &&
      String(lease.status) === DAILY_PLAY_LEASE_ACTIVE
    ) {
      foundActive = true;
      return {
        ...lease,
        courtId: target,
        leasedAt: new Date().toISOString(),
      };
    }
    return lease;
  });

  if (!foundActive) {
    nextLeases.push({
      id: `lease-${match.id}`,
      matchId: match.id,
      courtId: target,
      status: DAILY_PLAY_LEASE_ACTIVE,
      leasedAt: new Date().toISOString(),
      releasedAt: null,
    });
  }

  return {
    ok: true,
    state: bumpRevision({ ...next, matches }),
    leases: nextLeases,
    courtId: target,
    previousCourtId: match.courtId || null,
  };
}

export function buildCourtRuntimeView({ courts = [], matches = [], leases = [] } = {}) {
  const leased = getActiveLeaseCourtIds(leases);
  const byCourt = new Map();
  for (const match of matches || []) {
    if (
      (match.status === "assigned" || match.status === "playing") &&
      match.courtId != null
    ) {
      byCourt.set(String(match.courtId), match);
    }
  }

  return (courts || []).map((court) => {
    const id = String(court.id);
    const current = byCourt.get(id);
    const isLeased = leased.has(id);
    let status = "available";
    if (court.status === "locked" || court.status === "maintenance") {
      status = court.status;
    } else if (current || isLeased) {
      status = "playing";
    }
    return {
      id,
      name: court.name,
      status,
      locked: court.status === "locked",
      currentMatchId: current?.id || null,
      active: court.active !== false,
    };
  });
}
