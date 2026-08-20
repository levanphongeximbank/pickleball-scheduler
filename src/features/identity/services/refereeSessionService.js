import { listCanonicalRefereeAssignmentsForActor } from "./canonicalRefereeAssignmentDiscovery.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { ROLES, normalizeRole } from "../constants/roles.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { can } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";

/**
 * Referee hub discovery — CORE-13 canonical assignments only.
 * Fuzzy name/email matching is retired (LEGACY_TO_RETIRE closed for product path).
 */
export async function listRefereeAssignments({ clubId } = {}) {
  return listCanonicalRefereeAssignmentsForActor({ clubId });
}

export function canAccessRefereeSession(user, scope = {}) {
  if (!user) {
    return false;
  }

  return can(
    user,
    PERMISSIONS.MATCH_UPDATE,
    { clubId: scope.clubId, venueId: scope.venueId || user.venueId },
    { rbacEnabled: isRbacEnabled() }
  );
}

export function assertAuthenticatedRefereeActor(user = getCurrentUser()) {
  if (!user?.id) {
    return { ok: false, code: "NOT_AUTHENTICATED", error: "Chưa đăng nhập." };
  }
  if (isRbacEnabled()) {
    const isReferee =
      normalizeRole(user.role) === ROLES.REFEREE ||
      can(user, PERMISSIONS.MATCH_UPDATE, {}, { rbacEnabled: true });
    if (!isReferee) {
      return { ok: false, code: "FORBIDDEN", error: "Chỉ dành cho trọng tài." };
    }
  }
  return { ok: true, actorId: String(user.id) };
}
