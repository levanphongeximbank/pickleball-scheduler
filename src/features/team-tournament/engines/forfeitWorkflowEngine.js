/**
 * TT-4 — technical result types, reason codes, forfeit workflow helpers.
 */
import { SUB_MATCH_STATUS } from "../constants.js";

export const TECHNICAL_RESULT_TYPE = Object.freeze({
  NO_SHOW: "no_show",
  LATE_ARRIVAL: "late_arrival",
  INVALID_LINEUP: "invalid_lineup",
  WITHDRAWAL_BEFORE_MATCH: "withdrawal_before_match",
  WITHDRAWAL_DURING_MATCH: "withdrawal_during_match",
  INJURY: "injury",
  MISCONDUCT: "misconduct",
  TEAM_WITHDRAWAL: "team_withdrawal",
  ADMINISTRATIVE_FORFEIT: "administrative_forfeit",
  FORFEIT: "forfeit",
  TECHNICAL: "technical",
});

export const FORFEIT_BLOCK_CODES = Object.freeze({
  CONFIRMED_RESULT: "forfeit_blocked_confirmed_result",
  FORBIDDEN: "forfeit_forbidden",
  REASON_REQUIRED: "forfeit_reason_required",
  MATCHUP_NOT_READY: "matchup_not_ready",
  NOT_FOUND: "NOT_FOUND",
});

export const FORFEIT_REASON_OPTIONS = Object.freeze([
  { code: TECHNICAL_RESULT_TYPE.NO_SHOW, label: "Không có mặt" },
  { code: TECHNICAL_RESULT_TYPE.LATE_ARRIVAL, label: "Đến trễ" },
  { code: TECHNICAL_RESULT_TYPE.INVALID_LINEUP, label: "Lineup không hợp lệ" },
  { code: TECHNICAL_RESULT_TYPE.WITHDRAWAL_BEFORE_MATCH, label: "Bỏ cuộc trước trận" },
  { code: TECHNICAL_RESULT_TYPE.WITHDRAWAL_DURING_MATCH, label: "Bỏ cuộc giữa trận" },
  { code: TECHNICAL_RESULT_TYPE.INJURY, label: "Chấn thương" },
  { code: TECHNICAL_RESULT_TYPE.MISCONDUCT, label: "Vi phạm / misconduct" },
  { code: TECHNICAL_RESULT_TYPE.ADMINISTRATIVE_FORFEIT, label: "Thua kỹ thuật hành chính" },
]);

export const DEFAULT_TECHNICAL_SCORE_DEFAULTS = Object.freeze({
  winnerPoints: 11,
  loserPoints: 0,
  affectsStandings: true,
  affectsPointDifference: true,
  affectsElo: false,
});

export function resolveTechnicalScoreDefaults(settings = {}) {
  const raw = settings?.technicalScoreDefaults || {};
  return {
    winnerPoints: Number(raw.winnerPoints) || DEFAULT_TECHNICAL_SCORE_DEFAULTS.winnerPoints,
    loserPoints: Number(raw.loserPoints) || DEFAULT_TECHNICAL_SCORE_DEFAULTS.loserPoints,
    affectsStandings:
      raw.affectsStandings ?? DEFAULT_TECHNICAL_SCORE_DEFAULTS.affectsStandings,
    affectsPointDifference:
      raw.affectsPointDifference ?? DEFAULT_TECHNICAL_SCORE_DEFAULTS.affectsPointDifference,
    affectsElo: raw.affectsElo ?? DEFAULT_TECHNICAL_SCORE_DEFAULTS.affectsElo,
  };
}

export function resolveTechnicalScore(
  settings,
  teamAId,
  teamBId,
  forfeitingTeamId,
  override = {}
) {
  const defaults = resolveTechnicalScoreDefaults(settings);
  let teamA = forfeitingTeamId === teamAId ? defaults.loserPoints : defaults.winnerPoints;
  let teamB = forfeitingTeamId === teamBId ? defaults.loserPoints : defaults.winnerPoints;

  if (override.teamA != null) {
    teamA = Number(override.teamA);
  }
  if (override.teamB != null) {
    teamB = Number(override.teamB);
  }

  return { teamA, teamB, games: override.games || [] };
}

export function validateForfeitReason(reason, { minLength = 3 } = {}) {
  const trimmed = String(reason || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Lý do bắt buộc.", code: FORFEIT_BLOCK_CODES.REASON_REQUIRED };
  }
  if (trimmed.length < minLength) {
    return { ok: false, error: `Lý do tối thiểu ${minLength} ký tự.`, code: FORFEIT_BLOCK_CODES.REASON_REQUIRED };
  }
  return { ok: true, reason: trimmed };
}

export function isSubMatchConfirmedNormal(subMatch) {
  if (!subMatch) {
    return false;
  }
  return (
    subMatch.status === SUB_MATCH_STATUS.COMPLETED &&
    Boolean(subMatch.resultConfirmedAt)
  );
}

export function resolveCanApplyForfeitFromServer(forfeitOps) {
  if (!forfeitOps || typeof forfeitOps !== "object") {
    return { canApply: false, blockCode: null, blockMessage: null };
  }
  return {
    canApply: forfeitOps.canApplyForfeit === true,
    blockCode: forfeitOps.blockCode || null,
    blockMessage: forfeitOps.blockMessage || null,
    subMatchVersion: forfeitOps.subMatchVersion ?? null,
    technicalScoreDefaults: forfeitOps.technicalScoreDefaults || null,
  };
}

export function resolveForfeitReadiness({ subMatch, forfeitOps, forfeitingTeamId, matchup }) {
  if (!subMatch || !matchup) {
    return { ok: false, code: FORFEIT_BLOCK_CODES.NOT_FOUND, error: "Không tìm thấy trận." };
  }
  if (isSubMatchConfirmedNormal(subMatch)) {
    return {
      ok: false,
      code: FORFEIT_BLOCK_CODES.CONFIRMED_RESULT,
      error: "Trận con đã xác nhận — không thể apply forfeit trực tiếp.",
    };
  }
  const server = resolveCanApplyForfeitFromServer(forfeitOps);
  if (forfeitOps && !server.canApply) {
    return {
      ok: false,
      code: server.blockCode || FORFEIT_BLOCK_CODES.FORBIDDEN,
      error: server.blockMessage || "Không thể xử thua kỹ thuật.",
    };
  }
  if (
    forfeitingTeamId &&
    forfeitingTeamId !== matchup.teamAId &&
    forfeitingTeamId !== matchup.teamBId
  ) {
    return { ok: false, code: "VALIDATION", error: "Đội forfeit không hợp lệ." };
  }
  return { ok: true, subMatchVersion: server.subMatchVersion ?? subMatch.version ?? null };
}

export function buildForfeitCommandPayload({
  matchupId,
  subMatchId,
  forfeitingTeamId,
  resultType,
  reasonCode,
  reasonText,
  technicalScore,
  subMatchVersion,
  requestId,
}) {
  return {
    matchupId,
    subMatchId,
    forfeitingTeamId,
    scope: "sub_match",
    resultType: resultType || TECHNICAL_RESULT_TYPE.FORFEIT,
    reasonCode: reasonCode || "",
    reason: reasonText || "",
    forfeitReason: reasonText || "",
    technicalScore: technicalScore || {},
    expectedVersion: subMatchVersion ?? undefined,
    requestId: requestId || undefined,
  };
}

export function summarizeStandingsImpact(defaults) {
  const config = defaults || DEFAULT_TECHNICAL_SCORE_DEFAULTS;
  const parts = [];
  if (config.affectsStandings) {
    parts.push("ảnh hưởng BXH");
  }
  if (config.affectsPointDifference) {
    parts.push("ảnh hưởng hiệu số điểm");
  }
  if (!config.affectsElo) {
    parts.push("không cập nhật Elo");
  }
  return parts.join("; ") || "không ảnh hưởng BXH";
}
