/**
 * S1-G — Walkover workflow for Individual Tournament.
 * Builds on S1-F propagateMatchResult without modifying S1-F sources.
 */

import { createId } from "../../../utils/id.js";
import { MATCH_RESULT_TYPE } from "./matchResultEngine.js";
import { propagateMatchResult } from "./resultPropagationEngine.js";

export const WALKOVER_REASON = Object.freeze({
  NO_SHOW: "no_show",
  ORGANIZER: "organizer_declared",
  OTHER: "other",
});

export const RESULTS_OPS_AUDIT = Object.freeze({
  WALKOVER_DECLARED: "walkover_declared",
  WITHDRAWAL_REQUESTED: "withdrawal_requested",
  WITHDRAWAL_APPROVED: "withdrawal_approved",
  WITHDRAWAL_REJECTED: "withdrawal_rejected",
  AWARD_ASSIGNED: "award_assigned",
  TOURNAMENT_CLOSED: "tournament_closed",
  THIRD_PLACE_ENABLED: "third_place_enabled",
  THIRD_PLACE_GENERATED: "third_place_generated",
});

const AUDIT_CAP = 80;

function nowIso(now) {
  return now || new Date().toISOString();
}

function getResultsOps(tournament) {
  const raw = tournament?.settings?.resultsOps || {};
  return {
    includeThirdPlace: raw.includeThirdPlace !== false,
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : [],
    walkovers: Array.isArray(raw.walkovers) ? raw.walkovers : [],
    closed: raw.closed === true,
    closedAt: raw.closedAt || null,
    closedBy: raw.closedBy || "",
    summary: raw.summary || null,
    frozenStandings: raw.frozenStandings || null,
    frozenBrackets: raw.frozenBrackets || null,
    resultsLocked: raw.resultsLocked === true,
  };
}

function patchResultsOps(tournament, patch) {
  const current = getResultsOps(tournament);
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      resultsOps: {
        ...current,
        ...patch,
      },
    },
  };
}

export function appendResultsOpsAudit(tournament, entry, options = {}) {
  const ops = getResultsOps(tournament);
  const auditEntry = {
    id: createId("ops-audit"),
    action: entry.action,
    matchId: entry.matchId || "",
    entryId: entry.entryId || "",
    eventId: entry.eventId || "",
    actorId: entry.actor?.id || options.userId || "",
    reason: entry.reason || "",
    meta: entry.meta || null,
    timestamp: nowIso(options.now),
  };
  return patchResultsOps(tournament, {
    auditLog: [...ops.auditLog, auditEntry].slice(-AUDIT_CAP),
  });
}

export { getResultsOps, patchResultsOps };

/**
 * Organizer declares walkover (player no-show or explicit WO).
 * Winner auto-advances via S1-F propagation.
 */
export function declareWalkover(tournament, options = {}) {
  if (getResultsOps(tournament).closed || getResultsOps(tournament).resultsLocked) {
    return { ok: false, error: "Giải đã đóng / khóa kết quả." };
  }

  const matchId = String(options.matchId || "").trim();
  const winnerId = String(options.winnerId || "").trim();
  if (!matchId || !winnerId) {
    return { ok: false, error: "Thiếu matchId hoặc winnerId." };
  }

  const reasonType = Object.values(WALKOVER_REASON).includes(options.reasonType)
    ? options.reasonType
    : WALKOVER_REASON.ORGANIZER;

  const commandId = options.commandId || createId("cmd-wo");
  const propagated = propagateMatchResult(tournament, matchId, {
    eventId: options.eventId,
    actor: options.actor,
    commandId,
    source: "organizer_walkover",
    payload: {
      resultType: MATCH_RESULT_TYPE.WALKOVER,
      winnerId,
      reason: options.reason || reasonType,
    },
  });

  if (!propagated.ok) {
    return propagated;
  }

  const record = {
    id: createId("wo"),
    matchId,
    eventId: options.eventId || propagated.result?.eventId || "",
    winnerId,
    loserId: propagated.match?.loserId || "",
    reasonType,
    reason: options.reason || reasonType,
    declaredAt: nowIso(options.now),
    declaredBy: options.actor?.id || options.userId || "",
    commandId,
  };

  let next = propagated.tournament;
  const ops = getResultsOps(next);
  next = patchResultsOps(next, {
    walkovers: [...ops.walkovers, record],
  });
  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.WALKOVER_DECLARED,
      matchId,
      entryId: winnerId,
      eventId: record.eventId,
      actor: options.actor,
      reason: record.reason,
      meta: { reasonType, commandId },
    },
    options
  );

  return {
    ok: true,
    tournament: next,
    walkover: record,
    match: propagated.match,
    standings: propagated.standings,
    idempotentReplay: propagated.idempotentReplay,
  };
}

export function listWalkovers(tournament) {
  return getResultsOps(tournament).walkovers;
}
