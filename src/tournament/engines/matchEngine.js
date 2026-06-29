import { createMatchRecord, normalizeMatch } from "../../models/tournament/match.js";
import { MATCH_STATUS } from "../../models/tournament/constants.js";

function toScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function nowIso(timestamp) {
  return timestamp || new Date().toISOString();
}

export function resolveWinnerFromScore(entryAId, entryBId, scoreA, scoreB) {
  const a = toScore(scoreA);
  const b = toScore(scoreB);

  if (a === b) {
    return { winnerId: "", loserId: "", draw: true };
  }

  if (a > b) {
    return { winnerId: String(entryAId), loserId: String(entryBId), draw: false };
  }

  return { winnerId: String(entryBId), loserId: String(entryAId), draw: false };
}

export function startMatch(match, options = {}) {
  const normalized = normalizeMatch(match);
  if (!normalized) {
    return { ok: false, error: "Tran khong hop le." };
  }

  if (
    normalized.status !== MATCH_STATUS.WAITING &&
    normalized.status !== MATCH_STATUS.ASSIGNED &&
    normalized.status !== MATCH_STATUS.POSTPONED
  ) {
    return {
      ok: false,
      error: "Chi co the bat dau tran o trang thai cho, da gan san hoac hoan.",
    };
  }

  return {
    ok: true,
    match: normalizeMatch({
      ...normalized,
      status: MATCH_STATUS.PLAYING,
      startedAt: normalized.startedAt || nowIso(options.now),
    }),
  };
}

export function assignMatchCourt(match, courtId) {
  const normalized = normalizeMatch(match);
  if (!normalized) {
    return { ok: false, error: "Tran khong hop le." };
  }

  return {
    ok: true,
    match: normalizeMatch({
      ...normalized,
      courtId,
      status:
        normalized.status === MATCH_STATUS.WAITING
          ? MATCH_STATUS.ASSIGNED
          : normalized.status,
    }),
  };
}

export function submitMatchScore(match, scores = {}, options = {}) {
  const normalized = normalizeMatch(match);
  if (!normalized) {
    return { ok: false, error: "Tran khong hop le." };
  }

  const scoreA = toScore(scores.scoreA);
  const scoreB = toScore(scores.scoreB);
  const { winnerId, loserId, draw } = resolveWinnerFromScore(
    normalized.entryAId,
    normalized.entryBId,
    scoreA,
    scoreB
  );

  if (draw && !options.allowDraw) {
    return { ok: false, error: "Tran hoa chua duoc cho phep." };
  }

  return {
    ok: true,
    match: normalizeMatch({
      ...normalized,
      scoreA,
      scoreB,
      winnerId,
      loserId,
      status: MATCH_STATUS.COMPLETED,
      completedAt: nowIso(options.now),
    }),
  };
}

export function forfeitMatch(match, winnerEntryId, options = {}) {
  const normalized = normalizeMatch(match);
  if (!normalized) {
    return { ok: false, error: "Tran khong hop le." };
  }

  const winnerId = String(winnerEntryId || "").trim();
  const validWinner =
    winnerId === normalized.entryAId || winnerId === normalized.entryBId;

  if (!validWinner) {
    return { ok: false, error: "Doi thang bo cuoc khong hop le." };
  }

  const loserId =
    winnerId === normalized.entryAId ? normalized.entryBId : normalized.entryAId;

  return {
    ok: true,
    match: normalizeMatch({
      ...normalized,
      winnerId,
      loserId,
      status: MATCH_STATUS.FORFEIT,
      completedAt: nowIso(options.now),
    }),
  };
}

export function postponeMatch(match) {
  const normalized = normalizeMatch(match);
  if (!normalized) {
    return { ok: false, error: "Tran khong hop le." };
  }

  return {
    ok: true,
    match: normalizeMatch({
      ...normalized,
      status: MATCH_STATUS.POSTPONED,
      courtId: null,
    }),
  };
}

export function clearMatchResult(match) {
  const normalized = normalizeMatch(match);
  if (!normalized) {
    return { ok: false, error: "Tran khong hop le." };
  }

  return {
    ok: true,
    match: normalizeMatch({
      ...normalized,
      scoreA: null,
      scoreB: null,
      winnerId: "",
      loserId: "",
      status: MATCH_STATUS.ASSIGNED,
      completedAt: null,
    }),
  };
}

export function createMatchBetweenEntries(options = {}) {
  return createMatchRecord(options);
}
