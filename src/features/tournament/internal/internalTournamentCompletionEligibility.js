/**
 * Internal Tournament completion eligibility (IT-REV-002 / IT-P27-001).
 *
 * Hard invariant: LOCKED IS NOT COMPLETED.
 * Terminal competition outcomes reuse shared match semantics:
 *   MATCH_STATUS.COMPLETED | MATCH_STATUS.FORFEIT
 * (same as bracketEngine.isGroupStageComplete / rankingEngine).
 *
 * A. COMPETITION_COMPLETENESS — from pre-existing persisted state
 * B. CLOSE_SNAPSHOT — resultsOps.closed / summary / champion from close payload
 */
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { getResultsOps } from "../../individual-tournament/engines/walkoverEngine.js";
import {
  isOneGroupInternalEvent,
  listGroupStageMatches,
  isMatchCompletedStatus,
} from "./internalTournamentOneGroupCompletion.js";

export const INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE =
  "INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE";

/**
 * Genuine terminal competition result — ignores match.locked.
 * SOURCE: bracketEngine.isGroupStageComplete / rankingEngine / MATCH_STATUS.
 */
export function isInternalMatchGenuinelyTerminal(match) {
  if (!match) return false;
  return isMatchCompletedStatus(match.status);
}

export function isInternalFinalMatch(match) {
  const stage = String(match?.stage || match?.round || "").toLowerCase();
  return (
    stage === "final" ||
    stage === "chung ket" ||
    stage === "chung_ket" ||
    stage.includes("final")
  );
}

function hasChampionSnapshot(ops) {
  const summary = ops?.summary;
  if (summary?.champion?.entryId || summary?.champion?.entryName) return true;
  if (summary?.championId) return true;
  const awards = ops?.summary?.awards;
  if (Array.isArray(awards) && awards.some((a) => a?.key === "champion" && a?.entryId)) {
    return true;
  }
  return false;
}

/**
 * A. Competition completeness from authoritative pre-close tournament state.
 * Does not require resultsOps.closed / summary (those are produced by close).
 */
export function assertInternalCompetitionComplete(tournament) {
  if (!tournament) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Thiếu payload giải để đóng.",
      reason: "missing_tournament",
    };
  }

  const mode = String(tournament.mode || "").trim();
  if (mode && mode !== TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return { ok: true, skipped: true };
  }

  const event = tournament.events?.[0];
  if (!event) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Thiếu nội dung thi đấu.",
      reason: "missing_event",
    };
  }

  const matches = Array.isArray(event.matches) ? event.matches : [];
  if (!matches.length) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Chưa có trận để đóng giải.",
      reason: "no_matches",
    };
  }

  const incomplete = matches.filter((match) => !isInternalMatchGenuinelyTerminal(match));
  if (incomplete.length > 0) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: `Còn ${incomplete.length} trận chưa hoàn tất (locked không được tính là đã đấu).`,
      reason: "incomplete_matches",
      incompleteCount: incomplete.length,
    };
  }

  const groupCount = Array.isArray(event.groups) ? event.groups.length : 0;
  const groupMatches = listGroupStageMatches(event);
  if (groupCount < 1 || groupMatches.length < 1) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Thiếu vòng bảng hoàn tất.",
      reason: "missing_group_stage",
    };
  }

  if (isOneGroupInternalEvent(event)) {
    const ko = matches.filter((match) => match?.bracketMatchId);
    if (ko.length > 0) {
      return {
        ok: false,
        code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
        error: "Giải 1 bảng không được đóng khi còn trận knock-out.",
        reason: "one_group_has_knockout",
      };
    }
    return { ok: true, oneGroup: true };
  }

  const completedFinal = matches.find(
    (match) =>
      isInternalFinalMatch(match) &&
      isInternalMatchGenuinelyTerminal(match) &&
      Boolean(match.winnerId)
  );
  if (!completedFinal) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Vòng knock-out / chung kết chưa hoàn tất.",
      reason: "knockout_incomplete",
    };
  }

  return { ok: true, oneGroup: false };
}

/**
 * B. Close snapshot fields produced by closeTournament (merged/patch payload).
 */
export function assertInternalCloseSnapshot(tournament) {
  const ops = getResultsOps(tournament);
  if (ops.closed !== true) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Giải nội bộ chưa có trạng thái đóng kết quả (resultsOps.closed).",
      reason: "results_not_closed",
    };
  }
  if (!ops.summary || typeof ops.summary !== "object") {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Thiếu tóm tắt đóng giải (resultsOps.summary).",
      reason: "missing_summary",
    };
  }
  if (!hasChampionSnapshot(ops)) {
    return {
      ok: false,
      code: INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
      error: "Thiếu nhà vô địch trong snapshot đóng giải.",
      reason: "missing_champion",
    };
  }
  return { ok: true };
}

/**
 * Full eligibility for an already-closed-shaped tournament object
 * (competition + snapshot on the same object — used when object is pre-close state
 * for competition-only checks, or tests).
 */
export function assertInternalTournamentCompletionEligibility(tournament) {
  const competition = assertInternalCompetitionComplete(tournament);
  if (!competition.ok) return competition;
  if (competition.skipped) return competition;
  const snapshot = assertInternalCloseSnapshot(tournament);
  if (!snapshot.ok) return snapshot;
  return { ok: true, oneGroup: competition.oneGroup };
}

/**
 * Gate status→completed for Internal.
 * Competition proof MUST use pre-patch authoritative tournament.
 * Close snapshot MAY use merged close payload.
 *
 * @param {object} prePatchTournament — EXISTING server row mapped tournament
 * @param {string} nextStatus
 * @param {object} [mergedCloseTournament] — patch-merged close payload (optional)
 */
export function assertInternalStatusCompletionGate(
  prePatchTournament,
  nextStatus,
  mergedCloseTournament
) {
  const mode = String(
    prePatchTournament?.mode || mergedCloseTournament?.mode || ""
  ).trim();
  if (mode !== TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return { ok: true, skipped: true };
  }
  if (String(nextStatus || "") !== TOURNAMENT_STATUS.COMPLETED) {
    return { ok: true, skipped: true };
  }
  if (String(prePatchTournament?.status || "") === TOURNAMENT_STATUS.COMPLETED) {
    return { ok: true, noop: true };
  }

  const competition = assertInternalCompetitionComplete(prePatchTournament);
  if (!competition.ok) return competition;

  const snapshotSource = mergedCloseTournament || prePatchTournament;
  const snapshot = assertInternalCloseSnapshot(snapshotSource);
  if (!snapshot.ok) return snapshot;

  return { ok: true, oneGroup: competition.oneGroup };
}

/** Terminal parity matrix helper for tests / docs. */
export function classifyInternalMatchCompletionShape(match) {
  const locked = match?.locked === true;
  const terminal = isInternalMatchGenuinelyTerminal(match);
  return {
    locked,
    terminal,
    countsAsCompetitionComplete: terminal,
    lockedAloneCountsAsComplete: false,
  };
}
