import { isGlobalRole } from "../../identity/constants/roles.js";
import { writeAuditLog, AUDIT_ACTIONS } from "../../identity/services/auditService.js";
import {
  INTERVENTION_PHASE,
  INTERVENTION_GUARD_CODE,
  isTournamentSetupStatus,
} from "../constants.js";

export function guardPairingIntervention({
  user,
  phase = INTERVENTION_PHASE.TOURNAMENT,
  tournamentStatus = null,
  previewMode = false,
} = {}) {
  if (!isGlobalRole(user?.role)) {
    return {
      ok: false,
      code: INTERVENTION_GUARD_CODE.FORBIDDEN,
      error: "Chỉ Founder (Super Admin) mới có quyền can thiệp ghép cặp/bảng.",
    };
  }

  if (phase === INTERVENTION_PHASE.TOURNAMENT && !isTournamentSetupStatus(tournamentStatus)) {
    return {
      ok: false,
      code: INTERVENTION_GUARD_CODE.TOURNAMENT_STARTED,
      error: "Giải đã bắt đầu — không thể can thiệp ghép cặp/bảng.",
    };
  }

  if (phase === INTERVENTION_PHASE.COURT && !previewMode) {
    return {
      ok: false,
      code: INTERVENTION_GUARD_CODE.NOT_PREVIEW,
      error: "Chỉ can thiệp xếp sân khi đang xem trước lịch.",
    };
  }

  return { ok: true };
}

export function canPairingIntervention({
  user,
  phase = INTERVENTION_PHASE.TOURNAMENT,
  tournamentStatus = null,
  previewMode = false,
} = {}) {
  return guardPairingIntervention({ user, phase, tournamentStatus, previewMode }).ok;
}

export async function logPairingOverride({
  user,
  resourceType = "tournament",
  resourceId = "",
  clubId = null,
  action = AUDIT_ACTIONS.PAIRING_OVERRIDE,
  interventionType = "",
  before = null,
  after = null,
  reason = "",
} = {}) {
  return writeAuditLog({
    action,
    resourceType,
    resourceId,
    clubId,
    actor: user,
    metadata: {
      interventionType,
      reason,
      before,
      after,
    },
  });
}

export async function logGroupOverride(options = {}) {
  return logPairingOverride({
    ...options,
    action: AUDIT_ACTIONS.GROUP_OVERRIDE,
  });
}

export async function logCourtPairingOverride(options = {}) {
  return logPairingOverride({
    ...options,
    resourceType: "court_session",
    action: AUDIT_ACTIONS.PAIRING_OVERRIDE,
  });
}
