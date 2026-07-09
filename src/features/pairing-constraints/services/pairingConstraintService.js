import { isGlobalRole } from "../../identity/constants/roles.js";
import { writeAuditLog, AUDIT_ACTIONS } from "../../identity/services/auditService.js";
import { normalizePairingConstraints } from "../models/pairingConstraint.js";

export function guardFounderConstraints({ user } = {}) {
  if (!isGlobalRole(user?.role)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Chỉ Founder (Super Admin) mới được cấu hình quy tắc ghép cặp.",
    };
  }
  return { ok: true };
}

export function canManageFounderConstraints(user) {
  return guardFounderConstraints({ user }).ok;
}

export function getTournamentPairingConstraints(tournament) {
  return normalizePairingConstraints(tournament?.founderPairingConstraints || []);
}

export function mergeTournamentConstraintsPatch(tournament, constraints = []) {
  return {
    founderPairingConstraints: normalizePairingConstraints(constraints),
  };
}

export function getClubPairingConstraints(clubData) {
  return normalizePairingConstraints(clubData?.founderPairingConstraints || []);
}

export function mergeClubConstraintsPatch(clubData, constraints = []) {
  return {
    founderPairingConstraints: normalizePairingConstraints(constraints),
  };
}

export async function logConstraintChange({
  user,
  tournamentId = "",
  clubId = null,
  before = [],
  after = [],
} = {}) {
  return writeAuditLog({
    action: AUDIT_ACTIONS.PAIRING_OVERRIDE,
    resourceType: "tournament_pairing_constraints",
    resourceId: tournamentId,
    clubId,
    actor: user,
    metadata: {
      before,
      after,
      kind: "founder_pairing_constraints",
    },
  });
}
