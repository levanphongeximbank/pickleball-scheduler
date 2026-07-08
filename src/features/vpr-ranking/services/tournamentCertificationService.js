import { CERTIFICATION_STATUS } from "../../../models/tournament/constants.js";
import { resolveCertificationForLevel } from "../../../models/tournament/tournament.js";
import { getTournament, updateTournament } from "../../../domain/tournamentService.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { logVprAudit, VPR_AUDIT_ACTIONS } from "./vprAuditService.js";
import {
  listCertifications,
  upsertCertification,
} from "../storage/vprLocalStore.js";
import { isVprCloudSyncEnabled } from "../config/vprFlags.js";
import {
  rpcVprApproveCertification,
  rpcVprListPendingCertifications,
  rpcVprRejectCertification,
  rpcVprSyncCertification,
  rpcVprToggleRanking,
} from "./vprRpcService.js";

export function buildCertificationRow(clubId, tournament) {
  const tenantId =
    tournament.tenantId ||
    (typeof localStorage !== "undefined" ? resolveTenantIdForClub(clubId) : null);
  return {
    clubId,
    tenantId,
    tournamentId: tournament.id,
    name: tournament.name,
    tournamentLevel: tournament.tournamentLevel,
    mode: tournament.mode,
    certificationStatus: tournament.certificationStatus,
    rankingEnabled: tournament.rankingEnabled === true,
    rejectionReason: tournament.certification?.rejectionReason || "",
    hostClubName: tournament.hostClubName || "",
    region: tournament.region || "",
    requestedAt: tournament.certification?.requestedAt || new Date().toISOString(),
    reviewedAt: tournament.certification?.reviewedAt || null,
    reviewedBy: tournament.certification?.reviewedBy || null,
  };
}

export async function syncCertificationRequest(clubId, tournament) {
  if (!tournament) {
    return { ok: false, error: "Thiếu giải." };
  }

  const row = upsertCertification(buildCertificationRow(clubId, tournament));

  if (isVprCloudSyncEnabled()) {
    const rpc = await rpcVprSyncCertification(row);
    if (!rpc.ok && rpc.code !== "RPC_NOT_DEPLOYED" && rpc.code !== "NO_SUPABASE") {
      return rpc;
    }
  }

  return { ok: true, certification: row };
}

export async function listPendingCertifications() {
  if (isVprCloudSyncEnabled()) {
    const rpc = await rpcVprListPendingCertifications();
    if (rpc.ok && Array.isArray(rpc.items)) {
      return rpc.items;
    }
  }
  return listCertifications().filter(
    (row) => row.certificationStatus === CERTIFICATION_STATUS.PENDING
  );
}

export function listAllCertifications() {
  return listCertifications().sort((a, b) => {
    if (a.certificationStatus === CERTIFICATION_STATUS.PENDING) {
      return -1;
    }
    if (b.certificationStatus === CERTIFICATION_STATUS.PENDING) {
      return 1;
    }
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}

function patchTournamentCertification(clubId, tournamentId, patch) {
  const tournament = getTournament(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải trong CLB." };
  }
  return updateTournament(clubId, tournamentId, patch);
}

export async function approveCertification(certId, { actorUserId = null, notes = "" } = {}) {
  const rows = listCertifications();
  const cert = rows.find((row) => row.id === certId);
  if (!cert) {
    return { ok: false, error: "Không tìm thấy yêu cầu xác thực." };
  }

  const reviewedAt = new Date().toISOString();
  upsertCertification({
    ...cert,
    certificationStatus: CERTIFICATION_STATUS.APPROVED,
    rankingEnabled: true,
    reviewedAt,
    reviewedBy: actorUserId,
    rejectionReason: "",
    notes,
  });

  const patchResult = patchTournamentCertification(cert.clubId, cert.tournamentId, {
    certificationStatus: CERTIFICATION_STATUS.APPROVED,
    rankingEnabled: true,
    certification: {
      ...(getTournament(cert.clubId, cert.tournamentId)?.certification || {}),
      reviewedAt,
      reviewedBy: actorUserId,
      rejectionReason: "",
      notes,
    },
  });

  logVprAudit({
    action: VPR_AUDIT_ACTIONS.CERT_APPROVE,
    actorUserId,
    tournamentId: cert.tournamentId,
    clubId: cert.clubId,
    after: { certificationStatus: CERTIFICATION_STATUS.APPROVED },
  });

  if (isVprCloudSyncEnabled()) {
    await rpcVprApproveCertification(certId, { actorUserId, notes });
  }

  return { ok: true, tournament: patchResult.tournament, certification: cert };
}

export async function rejectCertification(certId, { actorUserId = null, reason = "" } = {}) {
  const rows = listCertifications();
  const cert = rows.find((row) => row.id === certId);
  if (!cert) {
    return { ok: false, error: "Không tìm thấy yêu cầu xác thực." };
  }

  const reviewedAt = new Date().toISOString();
  upsertCertification({
    ...cert,
    certificationStatus: CERTIFICATION_STATUS.REJECTED,
    rankingEnabled: false,
    reviewedAt,
    reviewedBy: actorUserId,
    rejectionReason: reason,
  });

  patchTournamentCertification(cert.clubId, cert.tournamentId, {
    certificationStatus: CERTIFICATION_STATUS.REJECTED,
    rankingEnabled: false,
    certification: {
      ...(getTournament(cert.clubId, cert.tournamentId)?.certification || {}),
      reviewedAt,
      reviewedBy: actorUserId,
      rejectionReason: reason,
    },
  });

  logVprAudit({
    action: VPR_AUDIT_ACTIONS.CERT_REJECT,
    actorUserId,
    tournamentId: cert.tournamentId,
    clubId: cert.clubId,
    after: { certificationStatus: CERTIFICATION_STATUS.REJECTED, reason },
  });

  if (isVprCloudSyncEnabled()) {
    await rpcVprRejectCertification(certId, { actorUserId, reason });
  }

  return { ok: true, certification: cert };
}

export async function toggleRankingEnabled(certId, enabled, { actorUserId = null } = {}) {
  const rows = listCertifications();
  const cert = rows.find((row) => row.id === certId);
  if (!cert) {
    return { ok: false, error: "Không tìm thấy yêu cầu xác thực." };
  }

  upsertCertification({ ...cert, rankingEnabled: enabled === true });
  patchTournamentCertification(cert.clubId, cert.tournamentId, {
    rankingEnabled: enabled === true,
  });

  logVprAudit({
    action: VPR_AUDIT_ACTIONS.RANKING_TOGGLE,
    actorUserId,
    tournamentId: cert.tournamentId,
    clubId: cert.clubId,
    after: { rankingEnabled: enabled === true },
  });

  if (isVprCloudSyncEnabled()) {
    await rpcVprToggleRanking(certId, enabled);
  }

  return { ok: true };
}

export function applyTournamentLevelChange(existingTournament, tournamentLevel) {
  return resolveCertificationForLevel(tournamentLevel, existingTournament || {});
}
