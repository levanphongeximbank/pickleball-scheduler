/**
 * TT-5B — Referee V5 bridge identity + eligibility (client-side helpers).
 */

export const REFEREE_LINK_STATUS = Object.freeze({
  NONE: "none",
  PENDING: "pending",
  PROVISIONED: "provisioned",
  ASSIGNED: "assigned",
  ACTIVE: "active",
  FINALIZED: "finalized",
  SYNC_ERROR: "sync_error",
  REVOKED: "revoked",
  REPROVISION_REQUIRED: "reprovision_required",
});

export const LEGACY_SCORE_BLOCK_CODES = Object.freeze([
  "referee_v5_linked_legacy_write_blocked",
  "referee_v5_match_active",
  "referee_v5_result_finalized",
]);

/** V5 match_id = external_sub_match_id per TT-5A contract. */
export function resolveRefereeMatchId(externalSubMatchId) {
  return String(externalSubMatchId || "").trim();
}

export function buildRefereeWorkspaceRoute(externalSubMatchId) {
  const matchId = resolveRefereeMatchId(externalSubMatchId);
  if (!matchId) {
    return null;
  }
  return `/referee/match/${matchId}`;
}

export function isLegacyScoreBlocked(scoreOps) {
  if (!scoreOps?.blockCode) {
    return false;
  }
  return LEGACY_SCORE_BLOCK_CODES.includes(scoreOps.blockCode);
}

export function canSaveLegacyDraft(scoreOps) {
  return scoreOps?.canSaveDraft === true && !isLegacyScoreBlocked(scoreOps);
}

export function canConfirmLegacyResult(scoreOps) {
  return scoreOps?.canConfirm === true && !isLegacyScoreBlocked(scoreOps);
}

export function canProvisionRefereeLink(refereeLinkOps) {
  return refereeLinkOps?.canProvision === true;
}

export function canRevokeRefereeLink(refereeLinkOps) {
  return refereeLinkOps?.canRevoke === true;
}

export function buildProvisionCommandPayload({
  matchupId,
  subMatchId,
  refereeAssignmentId,
  subMatchVersion,
  reason = "TT-5B BTC provision",
  source = "btc_ui",
}) {
  return {
    matchupId: String(matchupId),
    subMatchId: String(subMatchId),
    refereeAssignmentId,
    expectedSubMatchVersion: subMatchVersion ?? null,
    reason,
    source,
  };
}

export function buildRevokeLinkPayload({ subMatchId, reason, linkVersion }) {
  return {
    subMatchId: String(subMatchId),
    reason: String(reason || "").trim(),
    expectedLinkVersion: linkVersion ?? null,
  };
}

export function summarizeRefereeLinkStatus(refereeLinkOps) {
  if (!refereeLinkOps?.hasLink) {
    if (refereeLinkOps?.blockCode === "assignment_required") {
      return { label: "Cần phân công trọng tài", tone: "warning" };
    }
    if (refereeLinkOps?.canProvision) {
      return { label: "Đủ điều kiện provision", tone: "info" };
    }
    return {
      label: refereeLinkOps?.blockMessage || "Chưa tạo phiên trọng tài",
      tone: "default",
    };
  }

  switch (refereeLinkOps.status) {
    case REFEREE_LINK_STATUS.PROVISIONED:
    case REFEREE_LINK_STATUS.ASSIGNED:
      return { label: "Đã provision", tone: "success" };
    case REFEREE_LINK_STATUS.ACTIVE:
      return { label: "Đang active", tone: "warning" };
    case REFEREE_LINK_STATUS.FINALIZED:
      return { label: "Đã finalized", tone: "success" };
    case REFEREE_LINK_STATUS.SYNC_ERROR:
      return { label: "Lỗi đồng bộ", tone: "error" };
    case REFEREE_LINK_STATUS.REPROVISION_REQUIRED:
      return { label: "Cần reprovision", tone: "warning" };
    default:
      return { label: refereeLinkOps.status || "Đã liên kết", tone: "info" };
  }
}
