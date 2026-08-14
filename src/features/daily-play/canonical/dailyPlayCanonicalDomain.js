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
import { getPlayerGenderKey } from "../../../models/player.js";
import {
  DAILY_MATCH_TYPE,
  getDailyMatchShape,
  resolveCanonicalPersistedMatchTypeFromMatch,
} from "./dailyPlayMatchShape.js";

const CLOSABLE_TOURNAMENT_STATUSES = new Set([
  "draft",
  "registration",
  "ready",
  "active",
]);

export function emptyDailyPlayState() {
  return {
    revision: 0,
    checkedInPlayerIds: [],
    matchType: "mixed_double",
    genderFilter: "all",
    enabledCourtIds: [],
    matches: [],
    skipScore: false,
    closedAt: null,
    closedBy: null,
    closeSummary: null,
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
    closedAt: raw.closedAt || raw.closed_at || null,
    closedBy: raw.closedBy || raw.closed_by || null,
    closeSummary:
      raw.closeSummary && typeof raw.closeSummary === "object"
        ? {
            completedMatchCount: Number(raw.closeSummary.completedMatchCount || 0),
            cancelledWaitingCount: Number(raw.closeSummary.cancelledWaitingCount || 0),
            checkedInCountAtClose: Number(raw.closeSummary.checkedInCountAtClose || 0),
          }
        : null,
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
    matchType: match.matchType || match.competitionType || null,
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

export function sanitizeOccupiedCourtIds(rawIds = []) {
  if (!Array.isArray(rawIds)) return [];
  const ids = [];
  for (const item of rawIds) {
    if (item == null || item === "") continue;
    if (typeof item === "string" || typeof item === "number") {
      const id = String(item).trim();
      if (id) ids.push(id);
      continue;
    }
    if (typeof item === "object") {
      const id = String(item.courtId ?? item.court_id ?? "").trim();
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

export function resolveOccupiedCourtIds({ occupiedCourtIds, leases = [] } = {}) {
  if (Array.isArray(occupiedCourtIds)) {
    return sanitizeOccupiedCourtIds(occupiedCourtIds);
  }
  return [...getActiveLeaseCourtIds(leases)];
}

export function getActiveLeaseCourtIds(leases = []) {
  return new Set(
    (leases || [])
      .filter((lease) => String(lease.status) === DAILY_PLAY_LEASE_ACTIVE)
      .map((lease) => String(lease.courtId ?? lease.court_id ?? ""))
      .filter(Boolean)
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

export function validateDailyMatchShape(match = {}, fallbackMatchType) {
  const canonicalType = resolveCanonicalPersistedMatchTypeFromMatch(
    match,
    fallbackMatchType
  );
  if (!canonicalType) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.INVALID_MATCH_TYPE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_TYPE],
    };
  }
  const shape = getDailyMatchShape(canonicalType);
  const teamSize = shape.teamSize;
  const playersPerMatch = shape.playersPerMatch;
  const teamA = Array.isArray(match.teamAPlayerIds)
    ? match.teamAPlayerIds.map(String).filter(Boolean)
    : [];
  const teamB = Array.isArray(match.teamBPlayerIds)
    ? match.teamBPlayerIds.map(String).filter(Boolean)
    : [];
  const players = [
    ...(match.playerIds || []),
    ...teamA,
    ...teamB,
  ].map(String).filter(Boolean);
  const distinct = [...new Set(players)];

  if (teamA.length || teamB.length) {
    if (teamA.length !== teamSize || teamB.length !== teamSize) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.INVALID_MATCH_SHAPE,
        error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_SHAPE],
        shape,
      };
    }
  }

  if (distinct.length !== playersPerMatch) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.INVALID_MATCH_SHAPE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_SHAPE],
      shape,
    };
  }

  return { ok: true, playerIds: distinct, shape, matchType: canonicalType };
}

function readTeamIds(match, side) {
  const raw =
    side === "B" ? match?.teamBPlayerIds || [] : match?.teamAPlayerIds || [];
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function genderKeyForPlayer(genderByPlayerId, playerId) {
  const raw =
    genderByPlayerId instanceof Map
      ? genderByPlayerId.get(String(playerId))
      : genderByPlayerId?.[String(playerId)];
  return getPlayerGenderKey(raw);
}

function countGenders(ids, genderByPlayerId) {
  let male = 0;
  let female = 0;
  let other = 0;
  let unknown = 0;
  for (const id of ids) {
    const key = genderKeyForPlayer(genderByPlayerId, id);
    if (key === "male") male += 1;
    else if (key === "female") female += 1;
    else if (key === "other") other += 1;
    else unknown += 1;
  }
  return { male, female, other, unknown };
}

function genderCompositionFailure() {
  return {
    ok: false,
    code: DAILY_PLAY_CODE.INVALID_MATCH_GENDER_COMPOSITION,
    error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_GENDER_COMPOSITION],
  };
}

export function validateDailyMatchGenderComposition(
  match = {},
  genderByPlayerId = {},
  canonicalType
) {
  const matchType =
    canonicalType || resolveCanonicalPersistedMatchTypeFromMatch(match);
  if (!matchType) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.INVALID_MATCH_TYPE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_TYPE],
    };
  }
  const teamA = readTeamIds(match, "A");
  const teamB = readTeamIds(match, "B");
  const all = [...teamA, ...teamB];
  const allCounts = countGenders(all, genderByPlayerId);
  const teamACounts = countGenders(teamA, genderByPlayerId);
  const teamBCounts = countGenders(teamB, genderByPlayerId);

  if (matchType === DAILY_MATCH_TYPE.MEN_SINGLE) {
    if (teamA.length !== 1 || teamB.length !== 1) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.INVALID_MATCH_SHAPE,
        error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_SHAPE],
      };
    }
    if (allCounts.male !== 2 || allCounts.female || allCounts.other || allCounts.unknown) {
      return genderCompositionFailure();
    }
    return { ok: true, matchType };
  }

  if (matchType === DAILY_MATCH_TYPE.WOMEN_SINGLE) {
    if (teamA.length !== 1 || teamB.length !== 1) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.INVALID_MATCH_SHAPE,
        error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_SHAPE],
      };
    }
    if (allCounts.female !== 2 || allCounts.male || allCounts.other || allCounts.unknown) {
      return genderCompositionFailure();
    }
    return { ok: true, matchType };
  }

  if (matchType === DAILY_MATCH_TYPE.MEN_DOUBLE) {
    if (allCounts.male !== 4 || allCounts.female || allCounts.other || allCounts.unknown) {
      return genderCompositionFailure();
    }
    return { ok: true, matchType };
  }

  if (matchType === DAILY_MATCH_TYPE.WOMEN_DOUBLE) {
    if (allCounts.female !== 4 || allCounts.male || allCounts.other || allCounts.unknown) {
      return genderCompositionFailure();
    }
    return { ok: true, matchType };
  }

  if (matchType === DAILY_MATCH_TYPE.MIXED_DOUBLE) {
    if (
      teamACounts.male !== 1 ||
      teamACounts.female !== 1 ||
      teamBCounts.male !== 1 ||
      teamBCounts.female !== 1 ||
      teamACounts.other ||
      teamACounts.unknown ||
      teamBCounts.other ||
      teamBCounts.unknown
    ) {
      return genderCompositionFailure();
    }
    return { ok: true, matchType };
  }

  if (matchType === DAILY_MATCH_TYPE.OPEN_DOUBLE) {
    return { ok: true, matchType };
  }

  return {
    ok: false,
    code: DAILY_PLAY_CODE.INVALID_MATCH_TYPE,
    error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_TYPE],
  };
}

export function validateDoublesMatchShape(match = {}) {
  return validateDailyMatchShape(match, match.matchType || match.competitionType || "mixed_double");
}

export function listAvailableCourts({
  courts = [],
  matches = [],
  leases = [],
  occupiedCourtIds,
} = {}) {
  const leased = getActiveLeaseCourtIds(leases);
  const occupied = getOccupiedCourtIdsFromMatches(matches);
  const globalOccupied = new Set(
    resolveOccupiedCourtIds({ occupiedCourtIds, leases })
  );
  return (courts || []).filter((court) => {
    const id = String(court.id);
    return !leased.has(id) && !occupied.has(id) && !globalOccupied.has(id);
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

export function validateProposedMatchPlayers(match, { checkedInPlayerIds, matches, matchType }) {
  const shape = validateDailyMatchShape(match, matchType);
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
  { checkedInPlayerIds = [], isEligible = () => true, matchType } = {}
) {
  const shape = validateDailyMatchShape(match, matchType);
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
  matchType,
  playersPerMatch,
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

  const perMatch = Number(
    playersPerMatch || getDailyMatchShape(matchType).playersPerMatch || 4
  );
  const capacity = Math.floor(Number(eligiblePlayerCount) / perMatch);
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

export function isNoCourtWaitingCopy(text) {
  if (text == null || text === "") return false;
  const value = String(text);
  return (
    value === DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING ||
    value === DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_AVAILABLE]
  );
}

export function shouldShowNoCourtWaitingWarning(availableCourtCount) {
  return Number(availableCourtCount) === 0;
}

export function isObsoleteNoCourtAvailabilityError(error, availableCourtCount) {
  return isNoCourtWaitingCopy(error) && Number(availableCourtCount) > 0;
}

export function resolveCreateCourtWaitingNote({
  availableCourtCount,
  waitingForCourt = false,
} = {}) {
  if (Number(availableCourtCount) > 0) return "";
  if (waitingForCourt === true || Number(availableCourtCount) === 0) {
    return DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING;
  }
  return "";
}

export function resolveAssignCourtId(courtId, availableCourts = []) {
  if (courtId != null && String(courtId).trim() !== "") {
    return String(courtId);
  }
  const first = Array.isArray(availableCourts) ? availableCourts[0] : null;
  const id = first?.id ?? first?.courtId ?? null;
  if (id == null || String(id).trim() === "") return null;
  return String(id);
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

export function applyCreateMatches(state, proposedMatches = [], options = {}) {
  let next = normalizeDailyPlayCanonicalState(state);
  const created = [];
  const genderByPlayerId = options.genderByPlayerId || {};

  for (const proposed of proposedMatches) {
    const canonicalType = resolveCanonicalPersistedMatchTypeFromMatch(
      proposed,
      proposed.matchType || proposed.competitionType || next.matchType
    );
    if (!canonicalType) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.INVALID_MATCH_TYPE,
        error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.INVALID_MATCH_TYPE],
      };
    }
    const validation = validateProposedMatchPlayers(proposed, {
      ...next,
      matchType: canonicalType,
    });
    if (!validation.ok) {
      return validation;
    }
    const gender = validateDailyMatchGenderComposition(
      proposed,
      genderByPlayerId,
      canonicalType
    );
    if (!gender.ok) {
      return gender;
    }
    const match = normalizeMatch({
      ...proposed,
      id: String(proposed.id || `daily-match-${Date.now()}-${created.length + 1}`),
      matchType: canonicalType,
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

export function dailyPlayCourtRuntimeLabel(status) {
  switch (String(status || "")) {
    case "available":
      return "trống";
    case "playing":
    case "occupied":
      return "đang dùng";
    case "locked":
      return "khóa";
    case "maintenance":
      return "bảo trì";
    default:
      return String(status || "");
  }
}

export function buildCourtRuntimeView({
  courts = [],
  matches = [],
  leases = [],
  occupiedCourtIds,
} = {}) {
  const leased = getActiveLeaseCourtIds(leases);
  const globalOccupied = new Set(
    resolveOccupiedCourtIds({ occupiedCourtIds, leases })
  );
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
    const isGloballyOccupied = leased.has(id) || globalOccupied.has(id);
    let status = "available";
    if (court.status === "locked" || court.status === "maintenance") {
      status = court.status;
    } else if (current) {
      status = "playing";
    } else if (isGloballyOccupied) {
      status = "occupied";
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

export function isDailySessionCompleted(status, dailyPlay = {}) {
  return (
    String(status || "") === "completed" ||
    Boolean(dailyPlay?.closedAt)
  );
}

export function assertDailyTournamentClosable(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED],
    };
  }
  if (!CLOSABLE_TOURNAMENT_STATUSES.has(normalized)) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.SESSION_NOT_ACTIVE,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.SESSION_NOT_ACTIVE],
    };
  }
  return { ok: true, status: normalized };
}

export function classifyDailyCloseReadiness(matches = []) {
  let assignedCount = 0;
  let playingCount = 0;
  let waitingCount = 0;
  let completedMatchCount = 0;
  let cancelledCount = 0;
  let unknownCount = 0;

  for (const match of matches || []) {
    const status = String(match.status || "waiting").trim().toLowerCase() || "waiting";
    if (status === "assigned") assignedCount += 1;
    else if (status === "playing") playingCount += 1;
    else if (status === "waiting") waitingCount += 1;
    else if (status === "completed" || status === "forfeit") completedMatchCount += 1;
    else if (status === "cancelled") cancelledCount += 1;
    else unknownCount += 1;
  }

  const blocked = assignedCount > 0 || playingCount > 0 || unknownCount > 0;
  return {
    ok: !blocked,
    assignedCount,
    playingCount,
    waitingCount,
    completedMatchCount,
    cancelledCount,
    unknownCount,
    code: blocked ? DAILY_PLAY_CODE.SESSION_CLOSE_BLOCKED : DAILY_PLAY_CODE.OK,
  };
}

export function formatSessionCloseBlockedMessage({
  assignedCount = 0,
  playingCount = 0,
  unknownCount = 0,
} = {}) {
  if (Number(unknownCount) > 0) {
    return `Chưa thể kết thúc buổi chơi.\nCòn trận ở trạng thái không hợp lệ để đóng buổi.`;
  }
  return `Chưa thể kết thúc buổi chơi.\nCòn ${Number(playingCount) || 0} trận đang thi đấu và ${Number(assignedCount) || 0} trận đã xếp sân.`;
}

export function formatSessionCloseConfirmMessage({ waitingCount = 0, checkedInCount = 0 } = {}) {
  return `Kết thúc buổi chơi?\n${Number(waitingCount) || 0} trận chưa thi đấu sẽ được hủy.\n${Number(checkedInCount) || 0} VĐV đang check-in sẽ được kết thúc phiên.`;
}

export function applyCloseSession(state, { actorId = "", now = new Date().toISOString() } = {}) {
  const actor = String(actorId || "").trim();
  if (!actor) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.NOT_AUTHENTICATED,
      error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NOT_AUTHENTICATED],
    };
  }
  const next = normalizeDailyPlayCanonicalState(state);
  const readiness = classifyDailyCloseReadiness(next.matches);
  if (!readiness.ok) {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.SESSION_CLOSE_BLOCKED,
      error: formatSessionCloseBlockedMessage(readiness),
      assignedCount: readiness.assignedCount,
      playingCount: readiness.playingCount,
      unknownCount: readiness.unknownCount,
    };
  }

  const checkedInCountAtClose = (next.checkedInPlayerIds || []).length;
  let cancelledWaitingCount = 0;
  const matches = next.matches.map((match) => {
    if (String(match.status) !== "waiting") {
      return match;
    }
    cancelledWaitingCount += 1;
    return {
      ...match,
      status: "cancelled",
      reason: "session_closed",
      cancelledAt: now,
    };
  });

  const closeSummary = {
    completedMatchCount: readiness.completedMatchCount,
    cancelledWaitingCount,
    checkedInCountAtClose,
  };

  return {
    ok: true,
    state: bumpRevision({
      ...next,
      matches,
      checkedInPlayerIds: [],
      closedAt: now,
      closedBy: actor,
      closeSummary,
    }),
    closeSummary,
    cancelledWaitingCount,
    releasedOwnLeases: true,
  };
}
