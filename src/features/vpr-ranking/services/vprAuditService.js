import { writeAuditLog } from "../../identity/services/auditService.js";
import { appendVprAuditLog } from "../storage/vprLocalStore.js";

export const VPR_AUDIT_ACTIONS = {
  CERT_APPROVE: "certification.approve",
  CERT_REJECT: "certification.reject",
  RANKING_TOGGLE: "ranking.toggle",
  VPR_AWARD: "vpr.award",
  VPR_RECALCULATE: "vpr.recalculate",
  VPR_MANUAL_ADJUST: "vpr.manual_adjust",
};

export function logVprAudit({
  action,
  actorUserId = null,
  tournamentId = null,
  clubId = null,
  vprAthleteId = null,
  before = null,
  after = null,
  metadata = {},
}) {
  const entry = appendVprAuditLog({
    action,
    actorUserId,
    tournamentId,
    clubId,
    vprAthleteId,
    before,
    after,
    metadata,
  });

  writeAuditLog({
    action: "update",
    resourceType: "vpr_ranking",
    resourceId: tournamentId || vprAthleteId,
    clubId,
    metadata: { vprAction: action, ...metadata, before, after },
  }).catch(() => {});

  return entry;
}
