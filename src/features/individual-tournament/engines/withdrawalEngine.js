/**
 * S1-G — Individual withdrawal workflow (before / during / injury) + replacement.
 */

import { createId } from "../../../utils/id.js";
import { ENTRY_STATUS, MATCH_STATUS } from "../../../models/tournament/constants.js";
import { isDrawEligibleEntry } from "../../../models/tournament/entry.js";
import {
  RESULTS_OPS_AUDIT,
  appendResultsOpsAudit,
  getResultsOps,
} from "./walkoverEngine.js";
import { MATCH_RESULT_TYPE } from "./matchResultEngine.js";
import { propagateMatchResult, recalculateDownstream } from "./resultPropagationEngine.js";
import { clearMatchResult } from "../../../tournament/engines/matchEngine.js";

export const WITHDRAWAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const WITHDRAWAL_PHASE = Object.freeze({
  BEFORE_EVENT: "before_event",
  DURING_EVENT: "during_event",
  INJURY: "injury",
});

function nowIso(now) {
  return now || new Date().toISOString();
}

function listWithdrawals(tournament) {
  const raw = tournament?.settings?.withdrawals;
  return Array.isArray(raw) ? raw : [];
}

function writeWithdrawals(tournament, list) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      withdrawals: list,
    },
  };
}

function findEntry(tournament, entryId, eventId = "") {
  for (const event of tournament?.events || []) {
    if (eventId && String(event.id) !== String(eventId)) continue;
    const entry = (event.entries || []).find((e) => String(e.id) === String(entryId));
    if (entry) return { entry, event };
  }
  return { entry: null, event: null };
}

export function isEntryWithdrawn(tournament, entryId) {
  return listWithdrawals(tournament).some(
    (w) =>
      String(w.entryId) === String(entryId) &&
      w.status === WITHDRAWAL_STATUS.APPROVED
  );
}

export function listPendingWithdrawals(tournament) {
  return listWithdrawals(tournament).filter((w) => w.status === WITHDRAWAL_STATUS.PENDING);
}

export function listWithdrawalHistory(tournament) {
  return listWithdrawals(tournament);
}

export function requestWithdrawal(tournament, options = {}) {
  if (getResultsOps(tournament).closed) {
    return { ok: false, error: "Giải đã đóng." };
  }

  const entryId = String(options.entryId || "").trim();
  const { entry, event } = findEntry(tournament, entryId, options.eventId);
  if (!entry) {
    return { ok: false, error: "Không tìm thấy cặp/đội đăng ký." };
  }

  if (isEntryWithdrawn(tournament, entryId)) {
    return { ok: false, error: "Đã rút lui." };
  }

  if (
    listPendingWithdrawals(tournament).some((w) => String(w.entryId) === entryId)
  ) {
    return { ok: false, error: "Đã có yêu cầu rút lui đang chờ duyệt." };
  }

  const phase = Object.values(WITHDRAWAL_PHASE).includes(options.phase)
    ? options.phase
    : WITHDRAWAL_PHASE.BEFORE_EVENT;

  const record = {
    id: createId("wd"),
    entryId,
    eventId: event?.id || options.eventId || "",
    phase,
    reason: String(options.reason || "").trim() || phase,
    status: WITHDRAWAL_STATUS.PENDING,
    requestedAt: nowIso(options.now),
    requestedBy: options.actor?.id || options.userId || "",
    replacementEntryId: options.replacementEntryId
      ? String(options.replacementEntryId)
      : "",
    processedAt: null,
    processedBy: "",
    rejectReason: "",
  };

  let next = writeWithdrawals(tournament, [...listWithdrawals(tournament), record]);
  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.WITHDRAWAL_REQUESTED,
      entryId,
      eventId: record.eventId,
      actor: options.actor,
      reason: record.reason,
      meta: { phase, withdrawalId: record.id },
    },
    options
  );

  return { ok: true, tournament: next, withdrawal: record };
}

function markEntryWithdrawn(tournament, entryId, eventId, meta = {}) {
  const events = (tournament.events || []).map((event) => {
    if (eventId && String(event.id) !== String(eventId)) return event;
    return {
      ...event,
      entries: (event.entries || []).map((entry) =>
        String(entry.id) === String(entryId)
          ? {
              ...entry,
              status: ENTRY_STATUS.WITHDRAWN,
              withdrawnAt: meta.at || nowIso(),
              withdrawnReason: meta.reason || "",
              replacedByEntryId: meta.replacementEntryId || "",
            }
          : entry
      ),
    };
  });
  return { ...tournament, events };
}

/**
 * Remaining unfinished matches involving withdrawn entry:
 * - opponent gets walkover (during/injury)
 * - before_event + not yet played: clear/cancel open matches without scoring if no opponent impact needed
 */
function applyDuringEventForfeits(tournament, entryId, eventId, options = {}) {
  const event = (tournament.events || []).find((e) => String(e.id) === String(eventId))
    || tournament.events?.[0];
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  let next = tournament;
  const affected = [];

  for (const match of event.matches || []) {
    const involves =
      String(match.entryAId) === String(entryId) ||
      String(match.entryBId) === String(entryId);
    if (!involves) continue;
    if (
      match.status === MATCH_STATUS.COMPLETED ||
      match.status === MATCH_STATUS.FORFEIT ||
      match.locked
    ) {
      continue;
    }

    const winnerId =
      String(match.entryAId) === String(entryId) ? match.entryBId : match.entryAId;
    if (!winnerId) {
      // Bye / empty slot — clear match
      const cleared = clearMatchResult(match);
      const events = (next.events || []).map((ev) => {
        if (String(ev.id) !== String(event.id)) return ev;
        return {
          ...ev,
          matches: (ev.matches || []).map((m) =>
            String(m.id) === String(match.id)
              ? { ...cleared.match, status: MATCH_STATUS.POSTPONED, entryAId: "", entryBId: "" }
              : m
          ),
        };
      });
      next = { ...next, events };
      affected.push({ matchId: match.id, action: "cleared" });
      continue;
    }

    const result = propagateMatchResult(next, match.id, {
      eventId: event.id,
      actor: options.actor,
      commandId: options.commandId || createId(`cmd-wd-${match.id}`),
      payload: {
        resultType: MATCH_RESULT_TYPE.WALKOVER,
        winnerId,
        reason: options.reason || "withdrawal",
      },
    });
    if (!result.ok) {
      return result;
    }
    next = result.tournament;
    affected.push({ matchId: match.id, action: "walkover", winnerId });
  }

  return { ok: true, tournament: next, affected };
}

function applyReplacement(tournament, withdrawnEntryId, replacementEntryId, eventId) {
  if (!replacementEntryId) {
    return { ok: true, tournament };
  }

  const { entry: replacement, event } = findEntry(tournament, replacementEntryId, eventId);
  if (!replacement) {
    return { ok: false, error: "Đội thay thế không tồn tại." };
  }
  if (!isDrawEligibleEntry(replacement) && replacement.status !== ENTRY_STATUS.WAITLISTED) {
    return { ok: false, error: "Đội thay thế không đủ điều kiện." };
  }

  // Promote waitlisted replacement if needed
  let next = {
    ...tournament,
    events: (tournament.events || []).map((ev) => {
      if (eventId && String(ev.id) !== String(eventId) && String(ev.id) !== String(event?.id)) {
        return ev;
      }
      return {
        ...ev,
        entries: (ev.entries || []).map((entry) => {
          if (String(entry.id) === String(replacementEntryId)) {
            return {
              ...entry,
              status: ENTRY_STATUS.APPROVED,
              replacesEntryId: withdrawnEntryId,
            };
          }
          return entry;
        }),
        matches: (ev.matches || []).map((match) => {
          let nextMatch = match;
          if (String(match.entryAId) === String(withdrawnEntryId)) {
            nextMatch = { ...nextMatch, entryAId: replacementEntryId };
          }
          if (String(match.entryBId) === String(withdrawnEntryId)) {
            nextMatch = { ...nextMatch, entryBId: replacementEntryId };
          }
          return nextMatch;
        }),
      };
    }),
  };

  return { ok: true, tournament: next };
}

export function approveWithdrawal(tournament, withdrawalId, options = {}) {
  if (getResultsOps(tournament).closed) {
    return { ok: false, error: "Giải đã đóng." };
  }

  const list = listWithdrawals(tournament);
  const index = list.findIndex((w) => String(w.id) === String(withdrawalId));
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu rút lui." };
  }

  const record = list[index];
  if (record.status !== WITHDRAWAL_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  let next = tournament;
  const replacementId = options.replacementEntryId || record.replacementEntryId || "";

  if (record.phase === WITHDRAWAL_PHASE.BEFORE_EVENT) {
    // Mark withdrawn + optional replacement into unfinished matches
    next = markEntryWithdrawn(next, record.entryId, record.eventId, {
      reason: record.reason,
      replacementEntryId: replacementId,
      at: nowIso(options.now),
    });

    if (replacementId) {
      const replaced = applyReplacement(next, record.entryId, replacementId, record.eventId);
      if (!replaced.ok) return replaced;
      next = replaced.tournament;
    } else {
      // Cancel open matches involving entry without awarded points when before draw play
      const event = (next.events || []).find((e) => String(e.id) === String(record.eventId))
        || next.events?.[0];
      if (event) {
        const events = (next.events || []).map((ev) => {
          if (String(ev.id) !== String(event.id)) return ev;
          return {
            ...ev,
            matches: (ev.matches || []).map((match) => {
              const involves =
                String(match.entryAId) === String(record.entryId) ||
                String(match.entryBId) === String(record.entryId);
              if (!involves) return match;
              if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT) {
                return match;
              }
              return {
                ...match,
                status: MATCH_STATUS.POSTPONED,
                note: "withdrawal_before_event",
              };
            }),
          };
        });
        next = { ...next, events };
      }
    }
  } else {
    // during_event / injury → walkover remaining
    next = markEntryWithdrawn(next, record.entryId, record.eventId, {
      reason: record.reason,
      at: nowIso(options.now),
    });
    const forfeits = applyDuringEventForfeits(next, record.entryId, record.eventId, {
      actor: options.actor,
      reason: record.phase === WITHDRAWAL_PHASE.INJURY ? "injury_withdrawal" : "withdrawal",
    });
    if (!forfeits.ok) return forfeits;
    next = forfeits.tournament;
  }

  const recalculated = recalculateDownstream(next, record.entryId, {
    eventId: record.eventId,
  });
  if (recalculated.ok) {
    next = recalculated.tournament;
  }

  const updated = {
    ...record,
    status: WITHDRAWAL_STATUS.APPROVED,
    processedAt: nowIso(options.now),
    processedBy: options.actor?.id || options.userId || "",
    replacementEntryId: replacementId,
  };
  const nextList = listWithdrawals(next).map((w) =>
    String(w.id) === String(withdrawalId) ? updated : w
  );
  next = writeWithdrawals(next, nextList);
  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.WITHDRAWAL_APPROVED,
      entryId: record.entryId,
      eventId: record.eventId,
      actor: options.actor,
      reason: record.reason,
      meta: { phase: record.phase, replacementEntryId: replacementId },
    },
    options
  );

  return {
    ok: true,
    tournament: next,
    withdrawal: updated,
    standings: recalculated.standings || null,
  };
}

export function rejectWithdrawal(tournament, withdrawalId, options = {}) {
  const list = listWithdrawals(tournament);
  const index = list.findIndex((w) => String(w.id) === String(withdrawalId));
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu rút lui." };
  }
  const record = list[index];
  if (record.status !== WITHDRAWAL_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  const updated = {
    ...record,
    status: WITHDRAWAL_STATUS.REJECTED,
    processedAt: nowIso(options.now),
    processedBy: options.actor?.id || options.userId || "",
    rejectReason: options.reason || "rejected",
  };

  let next = writeWithdrawals(
    tournament,
    list.map((w, i) => (i === index ? updated : w))
  );
  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.WITHDRAWAL_REJECTED,
      entryId: record.entryId,
      eventId: record.eventId,
      actor: options.actor,
      reason: updated.rejectReason,
    },
    options
  );

  return { ok: true, tournament: next, withdrawal: updated };
}

/** Entries eligible for draw after excluding approved withdrawals. */
export function filterDrawEligibleEntries(entries = [], tournament = null) {
  return (entries || []).filter((entry) => {
    if (!isDrawEligibleEntry(entry)) return false;
    if (tournament && isEntryWithdrawn(tournament, entry.id)) return false;
    if (entry.status === ENTRY_STATUS.WITHDRAWN) return false;
    return true;
  });
}
