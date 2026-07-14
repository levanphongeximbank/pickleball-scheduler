/**
 * S1-F — Organizer correction workflow (blob-first, TT5-D pattern).
 * request → approve/reject → apply corrected result → recalculate downstream.
 */

import { createId } from "../../../utils/id.js";
import {
  MATCH_RESULT_TYPE,
  RESULT_AUDIT_ACTIONS,
  unlockMatchResultForCorrection,
  appendResultAudit,
  getMatchResult,
} from "./matchResultEngine.js";
import {
  propagateMatchResult,
  recalculateDownstream,
} from "./resultPropagationEngine.js";
import { clearMatchResult } from "../../../tournament/engines/matchEngine.js";

export const CORRECTION_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

function patchSettings(tournament, patch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      ...patch,
    },
  };
}

export function listResultCorrections(tournament) {
  const raw = tournament?.settings?.resultCorrections;
  return Array.isArray(raw) ? raw : [];
}

function writeCorrections(tournament, list) {
  return patchSettings(tournament, { resultCorrections: list });
}

export function requestResultCorrection(tournament, options = {}) {
  const matchId = String(options.matchId || "").trim();
  if (!matchId) {
    return { ok: false, error: "Thiếu matchId." };
  }

  const existing = getMatchResult(tournament, matchId);
  if (!existing || (!existing.locked && existing.status !== "locked" && existing.status !== "confirmed")) {
    // Allow correction request if match completed on event even without stored blob
    const event =
      (tournament.events || []).find((e) =>
        (e.matches || []).some((m) => String(m.id) === matchId)
      ) || tournament.events?.[0];
    const match = (event?.matches || []).find((m) => String(m.id) === matchId);
    if (!match || (match.status !== "completed" && match.status !== "forfeit")) {
      return { ok: false, error: "Chỉ sửa được trận đã có kết quả." };
    }
  }

  const pending = listResultCorrections(tournament).find(
    (c) => c.matchId === matchId && c.status === CORRECTION_STATUS.PENDING
  );
  if (pending) {
    return { ok: false, error: "Đã có yêu cầu sửa đang chờ duyệt.", correction: pending };
  }

  const correction = {
    id: createId("corr"),
    matchId,
    eventId: options.eventId ? String(options.eventId) : existing?.eventId || "",
    status: CORRECTION_STATUS.PENDING,
    requestedBy: options.actor?.id || options.userId || "",
    requestedAt: options.now || new Date().toISOString(),
    reason: String(options.reason || "").trim() || "Sửa kết quả",
    proposed: {
      resultType: options.resultType || MATCH_RESULT_TYPE.COMPLETED,
      scoreA: options.scoreA ?? null,
      scoreB: options.scoreB ?? null,
      winnerId: options.winnerId || "",
      reason: options.resultReason || "",
    },
    previous: existing
      ? {
          resultType: existing.resultType,
          scoreA: existing.scoreA,
          scoreB: existing.scoreB,
          winnerId: existing.winnerId,
          loserId: existing.loserId,
        }
      : null,
    reviewedBy: "",
    reviewedAt: null,
    reviewNote: "",
  };

  const next = writeCorrections(tournament, [...listResultCorrections(tournament), correction]);

  return { ok: true, tournament: next, correction };
}

export function rejectResultCorrection(tournament, correctionId, options = {}) {
  const list = listResultCorrections(tournament);
  const index = list.findIndex((c) => String(c.id) === String(correctionId));
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu sửa." };
  }
  const correction = list[index];
  if (correction.status !== CORRECTION_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  const updated = {
    ...correction,
    status: CORRECTION_STATUS.REJECTED,
    reviewedBy: options.actor?.id || options.userId || "",
    reviewedAt: options.now || new Date().toISOString(),
    reviewNote: options.note || "",
  };

  const nextList = list.map((c, i) => (i === index ? updated : c));
  return {
    ok: true,
    tournament: writeCorrections(tournament, nextList),
    correction: updated,
  };
}

export function approveResultCorrection(tournament, correctionId, options = {}) {
  const list = listResultCorrections(tournament);
  const index = list.findIndex((c) => String(c.id) === String(correctionId));
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu sửa." };
  }

  const correction = list[index];
  if (correction.status !== CORRECTION_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  const event =
    (tournament.events || []).find((e) => String(e.id) === String(correction.eventId)) ||
    (tournament.events || []).find((e) =>
      (e.matches || []).some((m) => String(m.id) === String(correction.matchId))
    );

  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung chứa trận." };
  }

  const match = (event.matches || []).find(
    (m) => String(m.id) === String(correction.matchId)
  );
  if (!match) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  // Unlock prior result
  let nextTournament = tournament;
  const unlocked = unlockMatchResultForCorrection(nextTournament, correction.matchId, {
    ...options,
    reason: correction.reason,
  });
  if (unlocked.ok) {
    nextTournament = unlocked.tournament;
  }

  // Clear match fields then re-propagate proposed result with fresh command id
  const cleared = clearMatchResult(match);
  if (!cleared.ok) {
    return cleared;
  }

  const events = (nextTournament.events || []).map((ev) => {
    if (String(ev.id) !== String(event.id)) return ev;
    return {
      ...ev,
      matches: (ev.matches || []).map((m) =>
        String(m.id) === String(match.id) ? cleared.match : m
      ),
    };
  });
  nextTournament = { ...nextTournament, events };

  const commandId = options.commandId || createId(`cmd-corr-${correction.id}`);
  const propagated = propagateMatchResult(nextTournament, match.id, {
    ...options,
    eventId: event.id,
    commandId,
    force: true,
    payload: {
      resultType: correction.proposed.resultType || MATCH_RESULT_TYPE.COMPLETED,
      scoreA: correction.proposed.scoreA,
      scoreB: correction.proposed.scoreB,
      winnerId: correction.proposed.winnerId,
      reason: correction.proposed.reason || correction.reason,
    },
  });

  if (!propagated.ok) {
    return propagated;
  }

  nextTournament = propagated.tournament;

  const recalculated = recalculateDownstream(nextTournament, match.id, {
    eventId: event.id,
  });
  if (recalculated.ok) {
    nextTournament = recalculated.tournament;
  }

  nextTournament = appendResultAudit(
    nextTournament,
    {
      action: RESULT_AUDIT_ACTIONS.CORRECTED,
      matchId: match.id,
      eventId: event.id,
      commandId,
      resultType: correction.proposed.resultType,
      winnerId: correction.proposed.winnerId || propagated.result?.winnerId,
      scoreA: correction.proposed.scoreA,
      scoreB: correction.proposed.scoreB,
      actor: options.actor || null,
      reason: correction.reason,
    },
    options
  );

  const updated = {
    ...correction,
    status: CORRECTION_STATUS.APPROVED,
    reviewedBy: options.actor?.id || options.userId || "",
    reviewedAt: options.now || new Date().toISOString(),
    reviewNote: options.note || "",
    appliedCommandId: commandId,
  };

  const nextList = listResultCorrections(nextTournament).map((c) =>
    String(c.id) === String(correctionId) ? updated : c
  );
  nextTournament = writeCorrections(nextTournament, nextList);

  return {
    ok: true,
    tournament: nextTournament,
    correction: updated,
    standings: recalculated.standings || propagated.standings,
    commandId,
  };
}
