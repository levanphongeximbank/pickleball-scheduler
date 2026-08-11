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

/** Explicit hard blocks — missing/null scoreOps is NOT among these. */
export const LEGACY_SCORE_HARD_BLOCK_CODES = Object.freeze([
  ...LEGACY_SCORE_BLOCK_CODES,
  "reprovision_required",
  "result_already_confirmed",
]);

/** V5 match_id = external_sub_match_id per TT-5A contract. */
export function resolveRefereeMatchId(externalSubMatchId) {
  return String(externalSubMatchId || "").trim();
}

export function buildRefereeWorkspaceRoute(externalSubMatchId, tournamentId = null) {
  const matchId = resolveRefereeMatchId(externalSubMatchId);
  if (!matchId) {
    return null;
  }
  const base = `/referee/match/${matchId}`;
  if (!tournamentId) {
    return base;
  }
  return `${base}?tournamentId=${encodeURIComponent(String(tournamentId))}`;
}

export function isLegacyScoreBlocked(scoreOps) {
  if (!scoreOps?.blockCode) {
    return false;
  }
  return LEGACY_SCORE_HARD_BLOCK_CODES.includes(String(scoreOps.blockCode));
}

/**
 * Legacy draft eligibility from scoreOps only.
 *
 * NULL/undefined scoreOps → allow (outer canEdit + lineup gates decide).
 * Explicit V5/immutable hard blockCodes → deny.
 * Explicit canSaveDraft === true → allow (if not hard-blocked).
 * Explicit canSaveDraft === false → deny.
 * Malformed objects without a clear allow signal → deny (fail closed).
 */
export function canSaveLegacyDraft(scoreOps) {
  if (scoreOps == null) {
    return true;
  }
  if (typeof scoreOps !== "object") {
    return false;
  }
  if (isLegacyScoreBlocked(scoreOps)) {
    return false;
  }
  if (scoreOps.canSaveDraft === true) {
    return true;
  }
  if (scoreOps.canSaveDraft === false) {
    return false;
  }
  return false;
}

/**
 * Legacy confirm eligibility — same null-fallback / hard-block contract as draft.
 */
export function canConfirmLegacyResult(scoreOps) {
  if (scoreOps == null) {
    return true;
  }
  if (typeof scoreOps !== "object") {
    return false;
  }
  if (isLegacyScoreBlocked(scoreOps)) {
    return false;
  }
  if (scoreOps.canConfirm === true) {
    return true;
  }
  if (scoreOps.canConfirm === false) {
    return false;
  }
  return false;
}

/**
 * Confirmed / completed / V5-finalized submatches are immutable on the legacy portal.
 */
export function isSubMatchImmutableForLegacyScore(subMatch) {
  if (!subMatch || typeof subMatch !== "object") {
    return true;
  }
  if (subMatch.resultConfirmedAt) {
    return true;
  }
  const status = String(subMatch.status || "").trim().toLowerCase();
  if (status === "completed" || status === "finalized") {
    return true;
  }
  if (isLegacyScoreBlocked(subMatch.scoreOps)) {
    const code = String(subMatch.scoreOps?.blockCode || "");
    if (
      code === "result_already_confirmed" ||
      code === "referee_v5_result_finalized"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Full Team Referee Portal +/- enablement contract.
 */
export function resolveLegacyScorePanelEditable({
  canEdit = false,
  hasOfficialLineup = false,
  scoreOps = null,
  subMatch = null,
} = {}) {
  return (
    canEdit === true &&
    hasOfficialLineup === true &&
    canSaveLegacyDraft(scoreOps) &&
    !isSubMatchImmutableForLegacyScore(subMatch || { scoreOps })
  );
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

export const REFEREE_V5_RESULT_SOURCE = "referee_v5";

export const REFEREE_OUTBOX_EVENT_TYPES = Object.freeze({
  MATCH_FINALIZED: "REFEREE_MATCH_FINALIZED",
  RESULT_REVISED: "REFEREE_RESULT_REVISED",
  MATCH_REOPENED: "REFEREE_MATCH_REOPENED",
  STANDINGS_RECALC: "STANDINGS_RECALC_REQUESTED",
});

/** Map V5 revision payload → TT sub-match summary (mirrors SQL mapper for unit tests). */
export function mapRefereeV5ResultToSubMatch({
  revision = {},
  matchup = {},
} = {}) {
  const reopened = ["cancelled", "void"].includes(String(revision.status || "").toLowerCase());
  const teamA = Number(revision.officialScore?.teamA ?? revision.finalScore?.teamA ?? 0);
  const teamB = Number(revision.officialScore?.teamB ?? revision.finalScore?.teamB ?? 0);
  let winnerTeamId = revision.winnerId || revision.winnerTeamId || null;

  if (reopened) {
    return {
      ok: true,
      score: { teamA: 0, teamB: 0, games: [] },
      winnerTeamId: null,
      status: "waiting",
      resultType: "reopened",
      source: REFEREE_V5_RESULT_SOURCE,
      reopened: true,
    };
  }

  if (winnerTeamId && ![matchup.teamAId, matchup.teamBId].includes(winnerTeamId)) {
    return { ok: false, code: "winner_team_mismatch" };
  }

  if (!winnerTeamId) {
    if (teamA > teamB) winnerTeamId = matchup.teamAId;
    else if (teamB > teamA) winnerTeamId = matchup.teamBId;
  }

  return {
    ok: true,
    score: { teamA, teamB, games: revision.games || [] },
    winnerTeamId,
    status: "completed",
    resultType: "normal",
    source: REFEREE_V5_RESULT_SOURCE,
    revisionId: revision.id,
    revisionNumber: revision.revision,
    reopened: false,
  };
}

export function normalizeRefereeOutboxEventType(eventType, revisionStatus) {
  const status = String(revisionStatus || "").toLowerCase();
  if (status === "cancelled" || status === "void") {
    return REFEREE_OUTBOX_EVENT_TYPES.MATCH_REOPENED;
  }
  if (eventType === REFEREE_OUTBOX_EVENT_TYPES.STANDINGS_RECALC && status === "overridden") {
    return REFEREE_OUTBOX_EVENT_TYPES.RESULT_REVISED;
  }
  if (eventType === REFEREE_OUTBOX_EVENT_TYPES.STANDINGS_RECALC) {
    return REFEREE_OUTBOX_EVENT_TYPES.MATCH_FINALIZED;
  }
  return eventType || "UNKNOWN";
}

export function shouldSkipStaleRevision(incomingRevision, appliedRevision) {
  if (appliedRevision == null || incomingRevision == null) {
    return false;
  }
  return Number(incomingRevision) < Number(appliedRevision);
}

export function canResyncRefereeLink(refereeLinkOps) {
  return refereeLinkOps?.canResync === true;
}

export function buildResyncLinkPayload({ subMatchId, linkVersion, reason = "TT-5C BTC resync" }) {
  return {
    subMatchId: String(subMatchId),
    reason,
    expectedLinkVersion: linkVersion ?? null,
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
