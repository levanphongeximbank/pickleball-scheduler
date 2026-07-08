import { writeAuditLog } from "../../identity/services/auditService.js";
import { appendPickVnRatingAuditLog } from "../storage/pickVnRatingLocalStore.js";

export const PICK_VN_RATING_AUDIT_ACTIONS = Object.freeze({
  VERIFY: "rating.verify",
  PROPOSE: "rating.propose",
  REJECT: "rating.reject",
  SYNC: "rating.sync",
});

export function logPickVnRatingAudit({
  action,
  actorUserId = null,
  clubId = null,
  playerId = null,
  authUserId = null,
  tournamentId = null,
  before = null,
  after = null,
  metadata = {},
}) {
  const entry = appendPickVnRatingAuditLog({
    action,
    actorUserId,
    clubId,
    playerId,
    authUserId,
    tournamentId,
    before,
    after,
    metadata,
  });

  writeAuditLog({
    action: "update",
    resourceType: "pick_vn_rating",
    resourceId: playerId || authUserId || clubId,
    clubId,
    metadata: { pickVnAction: action, ...metadata, before, after },
  }).catch(() => {});

  return entry;
}
