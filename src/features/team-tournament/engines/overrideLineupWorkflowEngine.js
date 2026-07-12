/**
 * TT-3 lineup override workflow — client-side readiness helpers (server SoT).
 */
import { LINEUP_STATUS } from "../constants.js";
import { EXTENDED_LINEUP_STATUS } from "./lineupStateMachine.js";
import { getLineup } from "../models/index.js";

export const OVERRIDE_BLOCK_CODES = Object.freeze({
  LINEUP_MISSING: "lineup_missing",
  LINEUP_NOT_OVERRIDABLE: "lineup_not_overridable",
  CONFIRMED_RESULT: "lineup_override_blocked_confirmed_result",
  FORBIDDEN: "override_forbidden",
  ELEVATED_REQUIRED: "override_elevated_required",
  REASON_REQUIRED: "override_reason_required",
  ELEVATED_REASON_REQUIRED: "override_elevated_reason_required",
});

export function resolveCanOverrideFromServer(lineupOps) {
  if (!lineupOps || typeof lineupOps !== "object") {
    return { canOverride: false, blockCode: null, blockMessage: null };
  }
  return {
    canOverride: lineupOps.canOverride === true,
    blockCode: lineupOps.blockCode || null,
    blockMessage: lineupOps.blockMessage || null,
    elevatedReasonRequired: lineupOps.elevatedReasonRequired === true,
    operationalWarning: lineupOps.operationalWarning || null,
    lineupVersion: lineupOps.lineupVersion ?? null,
    matchupVersion: lineupOps.matchupVersion ?? null,
  };
}

export function resolveOverrideReadiness({ teamData, matchup, teamId, lineupOps }) {
  const lineup = getLineup(teamData, matchup.id, teamId);
  const server = resolveCanOverrideFromServer(lineupOps);

  if (!lineup) {
    return {
      ...server,
      canOverride: false,
      blockCode: OVERRIDE_BLOCK_CODES.LINEUP_MISSING,
      blockMessage: "Chưa có đội hình cho đội này.",
    };
  }

  if (typeof lineupOps?.canOverride === "boolean") {
    return { ...server, lineupStatus: lineup.status, lineupVersion: lineup.version ?? server.lineupVersion };
  }

  const overridableStatuses = new Set([
    LINEUP_STATUS.LOCKED,
    LINEUP_STATUS.PUBLISHED,
    EXTENDED_LINEUP_STATUS.OVERRIDDEN,
  ]);

  if (!overridableStatuses.has(lineup.status)) {
    return {
      canOverride: false,
      blockCode: OVERRIDE_BLOCK_CODES.LINEUP_NOT_OVERRIDABLE,
      blockMessage: "Chỉ override lineup đã khóa hoặc đã công bố.",
      lineupStatus: lineup.status,
    };
  }

  return {
    canOverride: true,
    blockCode: null,
    blockMessage: null,
    lineupStatus: lineup.status,
    lineupVersion: lineup.version ?? null,
  };
}

export function isRepublishPending(matchup) {
  return (
    matchup?.requiresRepublish === true || matchup?.publishOps?.requiresRepublish === true
  );
}

export function isLineupVisibilityBlockedForOpponent(matchup) {
  return isRepublishPending(matchup);
}

export function resolveLineupDisplayStatus(lineup, matchup) {
  if (lineup?.status === EXTENDED_LINEUP_STATUS.OVERRIDDEN || isRepublishPending(matchup)) {
    return {
      label: "Đã thay đổi — chờ công bố lại",
      color: "warning",
      requiresRepublish: true,
    };
  }
  return null;
}

export function validateOverrideReason(reason, { elevatedReasonRequired = false } = {}) {
  const trimmed = String(reason || "").trim();
  if (!trimmed) {
    return { ok: false, code: OVERRIDE_BLOCK_CODES.REASON_REQUIRED, error: "Bắt buộc nhập lý do." };
  }
  if (elevatedReasonRequired && trimmed.length < 15) {
    return {
      ok: false,
      code: OVERRIDE_BLOCK_CODES.ELEVATED_REASON_REQUIRED,
      error: "Matchup đã bắt đầu — lý do phải có ít nhất 15 ký tự.",
    };
  }
  return { ok: true, reason: trimmed };
}

export function buildOverrideCommandVersions({ matchup, lineup }) {
  return {
    expectedMatchupVersion: Number(matchup?.version ?? 0),
    expectedLineupVersion: Number(lineup?.version ?? 0),
  };
}

export function isRefereeLineupBlocked(matchup) {
  return isRepublishPending(matchup);
}

export const OVERRIDDEN_LINEUP_IMMUTABLE = true;

export function canCaptainEditAfterOverride(lineup) {
  if (lineup?.status === EXTENDED_LINEUP_STATUS.OVERRIDDEN) {
    return false;
  }
  return true;
}
