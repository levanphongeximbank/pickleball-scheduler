/**
 * S1-F — Individual match result engine (blob-first).
 * Winner/loser, walkover, retirement, injury, DQ, third-place awareness,
 * start / submit / confirm, lock completed matches, command idempotency keys.
 */

import { createId } from "../../../utils/id.js";
import { MATCH_STAGE, MATCH_STATUS } from "../../../models/tournament/constants.js";
import { normalizeMatch } from "../../../models/tournament/match.js";
import {
  startMatch,
  submitMatchScore,
  forfeitMatch,
  clearMatchResult,
  resolveWinnerFromScore,
} from "../../../tournament/engines/matchEngine.js";

export const MATCH_RESULT_TYPE = Object.freeze({
  COMPLETED: "completed",
  WALKOVER: "walkover",
  RETIREMENT: "retirement",
  INJURY: "injury",
  DISQUALIFICATION: "disqualification",
  FORFEIT: "forfeit",
});

export const MATCH_RESULT_STATUS = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  CONFIRMED: "confirmed",
  LOCKED: "locked",
  CORRECTED: "corrected",
});

export const RESULT_AUDIT_ACTIONS = Object.freeze({
  SUBMITTED: "result_submitted",
  CONFIRMED: "result_confirmed",
  CORRECTED: "result_corrected",
  STARTED: "match_started",
});

const AUDIT_LOG_CAP = 80;
const COMMAND_IDS_CAP = 200;

function nowIso(now) {
  return now || new Date().toISOString();
}

function patchSettings(tournament, patch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      ...patch,
    },
  };
}

export function getResultPropagationState(tournament) {
  const raw = tournament?.settings?.resultPropagation || {};
  return {
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : [],
    processedCommandIds: Array.isArray(raw.processedCommandIds)
      ? raw.processedCommandIds
      : [],
  };
}

export function appendResultAudit(tournament, entry, options = {}) {
  const state = getResultPropagationState(tournament);
  const auditEntry = {
    id: createId("result-audit"),
    action: entry.action,
    matchId: entry.matchId || "",
    eventId: entry.eventId || "",
    commandId: entry.commandId || "",
    resultType: entry.resultType || "",
    winnerId: entry.winnerId || "",
    loserId: entry.loserId || "",
    scoreA: entry.scoreA ?? null,
    scoreB: entry.scoreB ?? null,
    actor: entry.actor || null,
    actorId: entry.actor?.id || options.userId || "",
    reason: entry.reason || "",
    timestamp: nowIso(options.now),
  };

  return patchSettings(tournament, {
    resultPropagation: {
      ...state,
      auditLog: [...state.auditLog, auditEntry].slice(-AUDIT_LOG_CAP),
    },
  });
}

export function isCommandProcessed(tournament, commandId) {
  if (!commandId) return false;
  return getResultPropagationState(tournament).processedCommandIds.includes(String(commandId));
}

export function markCommandProcessed(tournament, commandId) {
  if (!commandId) return tournament;
  const state = getResultPropagationState(tournament);
  if (state.processedCommandIds.includes(String(commandId))) {
    return tournament;
  }
  return patchSettings(tournament, {
    resultPropagation: {
      ...state,
      processedCommandIds: [...state.processedCommandIds, String(commandId)].slice(
        -COMMAND_IDS_CAP
      ),
    },
  });
}

export function normalizeStoredMatchResult(raw = {}, matchId = "") {
  if (!raw || typeof raw !== "object") return null;
  const resultType = Object.values(MATCH_RESULT_TYPE).includes(raw.resultType)
    ? raw.resultType
    : MATCH_RESULT_TYPE.COMPLETED;
  const status = Object.values(MATCH_RESULT_STATUS).includes(raw.status)
    ? raw.status
    : MATCH_RESULT_STATUS.DRAFT;

  return {
    matchId: String(raw.matchId || matchId),
    eventId: raw.eventId ? String(raw.eventId) : "",
    status,
    resultType,
    scoreA: raw.scoreA != null ? Number(raw.scoreA) : null,
    scoreB: raw.scoreB != null ? Number(raw.scoreB) : null,
    winnerId: raw.winnerId ? String(raw.winnerId) : "",
    loserId: raw.loserId ? String(raw.loserId) : "",
    isThirdPlace: Boolean(raw.isThirdPlace),
    commandId: raw.commandId ? String(raw.commandId) : "",
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 1,
    submittedAt: raw.submittedAt || null,
    confirmedAt: raw.confirmedAt || null,
    submittedBy: raw.submittedBy || "",
    confirmedBy: raw.confirmedBy || "",
    source: raw.source || "",
    reason: raw.reason || "",
    locked: Boolean(raw.locked) || status === MATCH_RESULT_STATUS.LOCKED,
  };
}

export function getMatchResults(tournament) {
  const raw = tournament?.settings?.matchResults;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.entries(raw).reduce((acc, [id, value]) => {
    const normalized = normalizeStoredMatchResult(value, id);
    if (normalized) acc[String(id)] = normalized;
    return acc;
  }, {});
}

export function getMatchResult(tournament, matchId) {
  return getMatchResults(tournament)[String(matchId)] || null;
}

function writeMatchResult(tournament, matchId, result) {
  const map = { ...getMatchResults(tournament) };
  map[String(matchId)] = normalizeStoredMatchResult(result, matchId);
  return patchSettings(tournament, { matchResults: map });
}

export function isMatchResultLocked(tournament, matchId) {
  const stored = getMatchResult(tournament, matchId);
  if (stored?.locked || stored?.status === MATCH_RESULT_STATUS.LOCKED) {
    return true;
  }
  return false;
}

export function isThirdPlaceMatch(match) {
  const stage = String(match?.stage || "").toLowerCase();
  return (
    stage === MATCH_STAGE.THIRD_PLACE ||
    String(match?.bracketMatchId || "").includes("third") ||
    Boolean(match?.isThirdPlace)
  );
}

function resolveWinnerLoser(match, resultType, options = {}) {
  if (options.winnerId) {
    const winnerId = String(options.winnerId);
    const loserId =
      winnerId === match.entryAId ? match.entryBId : match.entryAId;
    return { winnerId, loserId, scoreA: options.scoreA ?? null, scoreB: options.scoreB ?? null };
  }

  if (
    resultType === MATCH_RESULT_TYPE.COMPLETED ||
    options.scoreA != null ||
    options.scoreB != null
  ) {
    const scoreA = Number(options.scoreA) || 0;
    const scoreB = Number(options.scoreB) || 0;
    const resolved = resolveWinnerFromScore(match.entryAId, match.entryBId, scoreA, scoreB);
    if (resolved.draw && !options.allowDraw) {
      return { error: "Trận hòa chưa được cho phép." };
    }
    return {
      winnerId: resolved.winnerId,
      loserId: resolved.loserId,
      scoreA,
      scoreB,
    };
  }

  return { error: "Thiếu winnerId hoặc tỷ số." };
}

function applyResultTypeToMatch(match, payload, options = {}) {
  const resultType = payload.resultType || MATCH_RESULT_TYPE.COMPLETED;
  const resolved = resolveWinnerLoser(match, resultType, {
    ...options,
    ...payload,
  });
  if (resolved.error) {
    return { ok: false, error: resolved.error };
  }

  const base = {
    ...match,
    winnerId: resolved.winnerId,
    loserId: resolved.loserId,
    scoreA: resolved.scoreA,
    scoreB: resolved.scoreB,
    resultType,
    resultReason: payload.reason || options.reason || "",
    isThirdPlace: isThirdPlaceMatch(match),
    completedAt: nowIso(options.now),
    locked: true,
  };

  if (resultType === MATCH_RESULT_TYPE.COMPLETED) {
    const scored = submitMatchScore(match, { scoreA: resolved.scoreA, scoreB: resolved.scoreB }, options);
    if (!scored.ok) return scored;
    return {
      ok: true,
      match: normalizeMatch({
        ...scored.match,
        resultType,
        resultReason: base.resultReason,
        isThirdPlace: base.isThirdPlace,
        locked: true,
      }),
    };
  }

  // Walkover / retirement / injury / DQ / forfeit → forfeit path + resultType stamp
  const forfeited = forfeitMatch(match, resolved.winnerId, options);
  if (!forfeited.ok) return forfeited;

  return {
    ok: true,
    match: normalizeMatch({
      ...forfeited.match,
      scoreA: resolved.scoreA,
      scoreB: resolved.scoreB,
      resultType,
      resultReason: base.resultReason,
      isThirdPlace: base.isThirdPlace,
      status: MATCH_STATUS.FORFEIT,
      locked: true,
    }),
  };
}

export function startIndividualMatch(match, options = {}) {
  if (match?.locked || match?.status === MATCH_STATUS.COMPLETED || match?.status === MATCH_STATUS.FORFEIT) {
    return { ok: false, error: "Trận đã kết thúc / khóa, không thể bắt đầu lại." };
  }
  return startMatch(match, options);
}

/**
 * Referee/organizer submits a provisional score (not yet confirmed).
 */
export function submitMatchResult(tournament, match, payload = {}, options = {}) {
  if (!match?.id) {
    return { ok: false, error: "Trận không hợp lệ." };
  }

  if (isMatchResultLocked(tournament, match.id) && !options.allowCorrection) {
    return { ok: false, error: "Trận đã khóa kết quả.", code: "RESULT_LOCKED" };
  }

  const resultType = payload.resultType || MATCH_RESULT_TYPE.COMPLETED;
  if (!Object.values(MATCH_RESULT_TYPE).includes(resultType)) {
    return { ok: false, error: "Loại kết quả không hợp lệ." };
  }

  const applied = applyResultTypeToMatch(match, { ...payload, resultType }, options);
  if (!applied.ok) return applied;

  // Provisional: keep match playing/assigned until confirm unless options.confirmImmediately
  const provisionalMatch = options.confirmImmediately
    ? applied.match
    : normalizeMatch({
        ...match,
        scoreA: applied.match.scoreA,
        scoreB: applied.match.scoreB,
        winnerId: applied.match.winnerId,
        loserId: applied.match.loserId,
        resultType,
        resultReason: applied.match.resultReason,
        status: match.status === MATCH_STATUS.WAITING ? MATCH_STATUS.PLAYING : match.status,
        startedAt: match.startedAt || nowIso(options.now),
      });

  const commandId = options.commandId || createId("cmd");
  const stored = normalizeStoredMatchResult(
    {
      matchId: match.id,
      eventId: match.eventId || options.eventId || "",
      status: options.confirmImmediately
        ? MATCH_RESULT_STATUS.CONFIRMED
        : MATCH_RESULT_STATUS.SUBMITTED,
      resultType,
      scoreA: applied.match.scoreA,
      scoreB: applied.match.scoreB,
      winnerId: applied.match.winnerId,
      loserId: applied.match.loserId,
      isThirdPlace: isThirdPlaceMatch(match),
      commandId,
      version: (getMatchResult(tournament, match.id)?.version || 0) + 1,
      submittedAt: nowIso(options.now),
      submittedBy: options.actor?.id || options.userId || "",
      confirmedAt: options.confirmImmediately ? nowIso(options.now) : null,
      confirmedBy: options.confirmImmediately
        ? options.actor?.id || options.userId || ""
        : "",
      source: options.source || "referee",
      reason: payload.reason || "",
      locked: Boolean(options.confirmImmediately),
    },
    match.id
  );

  let next = writeMatchResult(tournament, match.id, stored);
  next = appendResultAudit(
    next,
    {
      action: RESULT_AUDIT_ACTIONS.SUBMITTED,
      matchId: match.id,
      eventId: stored.eventId,
      commandId,
      resultType,
      winnerId: stored.winnerId,
      loserId: stored.loserId,
      scoreA: stored.scoreA,
      scoreB: stored.scoreB,
      actor: options.actor || null,
      reason: payload.reason || "",
    },
    options
  );

  return {
    ok: true,
    tournament: next,
    match: provisionalMatch,
    finalizedMatch: applied.match,
    result: stored,
    commandId,
  };
}

/**
 * Confirm / finalize a submitted result → lock match.
 */
export function confirmMatchResult(tournament, matchId, options = {}) {
  const commandId = options.commandId || createId("cmd-confirm");
  if (isCommandProcessed(tournament, commandId)) {
    return {
      ok: true,
      tournament,
      idempotentReplay: true,
      commandId,
      result: getMatchResult(tournament, matchId),
    };
  }

  const stored = getMatchResult(tournament, matchId);
  if (!stored || stored.status === MATCH_RESULT_STATUS.DRAFT) {
    return { ok: false, error: "Chưa có kết quả để xác nhận." };
  }

  if (
    (stored.status === MATCH_RESULT_STATUS.CONFIRMED ||
      stored.status === MATCH_RESULT_STATUS.LOCKED) &&
    !options.allowCorrection
  ) {
    // Treat as idempotent success when same scores
    let next = markCommandProcessed(tournament, commandId);
    return {
      ok: true,
      tournament: next,
      idempotentReplay: true,
      commandId,
      result: stored,
    };
  }

  const confirmed = normalizeStoredMatchResult(
    {
      ...stored,
      status: MATCH_RESULT_STATUS.LOCKED,
      locked: true,
      confirmedAt: nowIso(options.now),
      confirmedBy: options.actor?.id || options.userId || "",
      commandId,
      version: stored.version + 1,
    },
    matchId
  );

  let next = writeMatchResult(tournament, matchId, confirmed);
  next = markCommandProcessed(next, commandId);
  next = appendResultAudit(
    next,
    {
      action: RESULT_AUDIT_ACTIONS.CONFIRMED,
      matchId,
      eventId: confirmed.eventId,
      commandId,
      resultType: confirmed.resultType,
      winnerId: confirmed.winnerId,
      loserId: confirmed.loserId,
      scoreA: confirmed.scoreA,
      scoreB: confirmed.scoreB,
      actor: options.actor || null,
      reason: options.reason || "",
    },
    options
  );

  return {
    ok: true,
    tournament: next,
    result: confirmed,
    commandId,
    idempotentReplay: false,
  };
}

/**
 * Finalize in one step: submit + confirm (organizer/referee confirm flow).
 */
export function finalizeMatchResult(tournament, match, payload = {}, options = {}) {
  const commandId = options.commandId || createId("cmd-finalize");
  if (isCommandProcessed(tournament, commandId)) {
    return {
      ok: true,
      tournament,
      idempotentReplay: true,
      commandId,
      match: match,
      result: getMatchResult(tournament, match.id),
    };
  }

  const submitted = submitMatchResult(
    tournament,
    match,
    payload,
    { ...options, commandId, confirmImmediately: true }
  );
  if (!submitted.ok) return submitted;

  let next = markCommandProcessed(submitted.tournament, commandId);
  next = appendResultAudit(
    next,
    {
      action: RESULT_AUDIT_ACTIONS.CONFIRMED,
      matchId: match.id,
      eventId: match.eventId || options.eventId || "",
      commandId,
      resultType: payload.resultType || MATCH_RESULT_TYPE.COMPLETED,
      winnerId: submitted.result.winnerId,
      loserId: submitted.result.loserId,
      scoreA: submitted.result.scoreA,
      scoreB: submitted.result.scoreB,
      actor: options.actor || null,
      reason: payload.reason || "finalize",
    },
    options
  );

  const lockedResult = {
    ...submitted.result,
    status: MATCH_RESULT_STATUS.LOCKED,
    locked: true,
    commandId,
    confirmedAt: nowIso(options.now),
    confirmedBy: options.actor?.id || options.userId || "",
  };
  next = writeMatchResult(next, match.id, lockedResult);

  return {
    ok: true,
    tournament: next,
    match: submitted.finalizedMatch,
    result: lockedResult,
    commandId,
    idempotentReplay: false,
  };
}

export function unlockMatchResultForCorrection(tournament, matchId, options = {}) {
  const stored = getMatchResult(tournament, matchId);
  if (!stored) {
    return { ok: false, error: "Không có kết quả để mở khóa." };
  }

  const unlocked = normalizeStoredMatchResult(
    {
      ...stored,
      status: MATCH_RESULT_STATUS.CORRECTED,
      locked: false,
      version: stored.version + 1,
    },
    matchId
  );

  let next = writeMatchResult(tournament, matchId, unlocked);
  next = appendResultAudit(
    next,
    {
      action: RESULT_AUDIT_ACTIONS.CORRECTED,
      matchId,
      eventId: unlocked.eventId,
      commandId: options.commandId || "",
      resultType: unlocked.resultType,
      actor: options.actor || null,
      reason: options.reason || "unlock_for_correction",
    },
    options
  );

  return { ok: true, tournament: next, result: unlocked };
}

export function clearIndividualMatchResult(match) {
  return clearMatchResult(match);
}

export { clearMatchResult, COMMAND_IDS_CAP };
