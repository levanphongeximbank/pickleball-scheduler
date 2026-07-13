/**
 * TT-5D — Referee assignment safety + access guard (client helpers).
 */

export const REFEREE_ASSIGNMENT_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  EXPIRED: "expired",
  REVOKED: "revoked",
  COMPLETED: "completed",
});

export const REFEREE_ACCESS_BLOCK_CODES = Object.freeze({
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  REFEREE_NOT_ASSIGNED: "REFEREE_NOT_ASSIGNED",
  ASSIGNMENT_EXPIRED: "referee_assignment_expired",
  ASSIGNMENT_REVOKED: "referee_assignment_revoked",
  ASSIGNMENT_NOT_ACTIVE: "referee_assignment_not_active",
  CROSS_TENANT: "cross_tenant_denied",
  BRIDGE_NOT_FOUND: "bridge_not_found",
  REQUIRES_REPUBLISH: "requires_republish",
  MATCH_FINALIZED: "match_finalized_read_only",
  READ_ONLY: "read_only",
});

export const CORRECTION_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

const STATUS_LABELS_VI = Object.freeze({
  pending: "Chờ kích hoạt",
  active: "Đang hoạt động",
  expired: "Đã hết hạn",
  revoked: "Đã thu hồi",
  completed: "Hoàn tất",
  read_only: "Chỉ xem",
});

const BLOCK_MESSAGES_VI = Object.freeze({
  NOT_AUTHENTICATED: "Cần đăng nhập.",
  REFEREE_NOT_ASSIGNED: "Bạn chưa được phân công trận này.",
  referee_assignment_expired: "Phân công đã hết hạn — không thể ghi điểm.",
  referee_assignment_revoked: "Phân công đã bị BTC thu hồi.",
  referee_assignment_not_active: "Phân công chưa active.",
  cross_tenant_denied: "Không có quyền truy cập tenant này.",
  bridge_not_found: "Trận chưa được provision Referee V5.",
  requires_republish: "Lineup cần công bố lại — workspace read-only.",
  match_finalized_read_only: "Trận đã finalized — chỉ xem hoặc yêu cầu correction.",
  read_only: "Chế độ chỉ xem.",
  correction_already_pending: "Đã có yêu cầu correction đang chờ.",
  match_not_finalized: "Trận chưa finalized — không thể correction.",
});

export function resolveRefereeAccessMessage(accessOps) {
  const code = accessOps?.blockCode || accessOps?.code;
  if (code && BLOCK_MESSAGES_VI[code]) {
    return BLOCK_MESSAGES_VI[code];
  }
  return accessOps?.error || accessOps?.message || "Không thể truy cập workspace.";
}

export function summarizeRefereeAccessState(accessOps = {}) {
  const blockCode = accessOps.blockCode || accessOps.code || null;
  const assignmentStatus = accessOps.assignmentStatus || null;
  const canWrite = accessOps.canWrite === true;
  const readOnly = accessOps.readOnly === true || blockCode === REFEREE_ACCESS_BLOCK_CODES.READ_ONLY;
  const denied =
    !accessOps.ok &&
    !readOnly &&
    blockCode !== REFEREE_ACCESS_BLOCK_CODES.READ_ONLY &&
    blockCode !== REFEREE_ACCESS_BLOCK_CODES.MATCH_FINALIZED;

  let severity = "info";
  if (denied) severity = "error";
  else if (readOnly || assignmentStatus === REFEREE_ASSIGNMENT_STATUS.EXPIRED) severity = "warning";
  else if (canWrite) severity = "success";

  return {
    ok: accessOps.ok === true,
    denied,
    canWrite,
    readOnly,
    blockCode,
    assignmentStatus,
    label: STATUS_LABELS_VI[assignmentStatus] || STATUS_LABELS_VI[readOnly ? "read_only" : "active"],
    message: resolveRefereeAccessMessage(accessOps),
    severity,
    pendingCorrectionCount: Number(accessOps.pendingCorrectionCount || 0),
    expiresAt: accessOps.expiresAt || null,
    revokeReason: accessOps.revokeReason || null,
    matchFinalized: accessOps.matchFinalized === true,
    linkStatus: accessOps.linkStatus || null,
  };
}

export function canRefereeWrite(accessOps) {
  return summarizeRefereeAccessState(accessOps).canWrite;
}

export function shouldShowCorrectionRequest(accessOps) {
  const state = summarizeRefereeAccessState(accessOps);
  return state.matchFinalized && !state.denied && state.pendingCorrectionCount === 0;
}

export function buildRefereeWorkspaceRoute(externalSubMatchId, tournamentId) {
  const matchId = String(externalSubMatchId || "").trim();
  if (!matchId) return null;
  const base = `/referee/match/${matchId}`;
  if (!tournamentId) return base;
  return `${base}?tournamentId=${encodeURIComponent(String(tournamentId))}`;
}

export function buildCreateAssignmentPayload({
  tournamentId,
  matchupId,
  subMatchId,
  refereeUserId,
  expiresAt = null,
  activate = true,
  reason = "TT-5D BTC assign",
}) {
  return {
    tournamentId: String(tournamentId),
    matchupId: String(matchupId),
    subMatchId: String(subMatchId),
    refereeUserId,
    expiresAt,
    activate,
    reason,
  };
}

export function buildRevokeAssignmentPayload({
  tournamentId,
  assignmentId,
  expectedVersion,
  reason,
}) {
  return {
    tournamentId: String(tournamentId),
    assignmentId,
    expectedVersion,
    reason,
  };
}

export function buildCorrectionRequestPayload({
  tournamentId,
  matchId,
  resultRevisionId,
  proposedScore,
  proposedWinner,
  reason,
  requestId,
}) {
  return {
    tournamentId: String(tournamentId),
    matchId: String(matchId),
    resultRevisionId,
    proposedScore,
    proposedWinner: proposedWinner || null,
    reason,
    requestId: requestId || `corr-${Date.now()}`,
  };
}

export function buildReviewCorrectionPayload({
  tournamentId,
  correctionRequestId,
  decision,
  reviewReason = null,
  expectedVersion = null,
}) {
  return {
    tournamentId: String(tournamentId),
    correctionRequestId,
    decision,
    reviewReason,
    expectedVersion,
  };
}

export function mapCorrectionStatusLabel(status) {
  const labels = {
    pending: "Chờ BTC duyệt",
    approved: "Đã duyệt",
    rejected: "Đã từ chối",
    cancelled: "Đã hủy",
  };
  return labels[status] || status;
}

export function isAssignmentExpired(accessOps) {
  return (
    accessOps?.assignmentStatus === REFEREE_ASSIGNMENT_STATUS.EXPIRED ||
    accessOps?.blockCode === REFEREE_ACCESS_BLOCK_CODES.ASSIGNMENT_EXPIRED
  );
}

export function isAssignmentRevoked(accessOps) {
  return (
    accessOps?.assignmentStatus === REFEREE_ASSIGNMENT_STATUS.REVOKED ||
    accessOps?.blockCode === REFEREE_ACCESS_BLOCK_CODES.ASSIGNMENT_REVOKED
  );
}

export function formatExpiryCountdown(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Đã hết hạn";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `Còn ${mins} phút`;
  const hours = Math.floor(mins / 60);
  return `Còn ${hours} giờ ${mins % 60} phút`;
}
