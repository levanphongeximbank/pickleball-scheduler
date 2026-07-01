import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { isClubScopedRole, isGlobalRole, isVenueScopedRole } from "../../../auth/roles.js";
import { listClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { getClubMembers } from "./clubMemberService.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";

/**
 * User có quyền xem CLB này không (ngoài RBAC permission).
 * - Venue roles / SUPER_ADMIN: toàn tenant
 * - CLUB_OWNER / PLAYER: CLB được gán hoặc là thành viên active
 */
export function canUserViewClub(user, clubId, tenantId) {
  if (!user || !clubId) {
    return true;
  }

  if (!isRbacEnabled()) {
    return true;
  }

  if (isGlobalRole(user.role) || isVenueScopedRole(user.role)) {
    return true;
  }

  if (user.clubId === clubId) {
    return true;
  }

  if (!isClubScopedRole(user.role)) {
    return false;
  }

  if (!user.playerId) {
    return false;
  }

  const members = getClubMembers(clubId, tenantId);
  return members.some(
    (m) =>
      m.playerId === user.playerId && m.status === CLUB_MEMBER_STATUSES.ACTIVE
  );
}

export function getClubsVisibleToUser(tenantId, user = getCurrentUser()) {
  const clubs = listClubsForTenant(tenantId).filter((club) => !club.isDefault);

  if (!isRbacEnabled() || !user) {
    return clubs;
  }

  if (isGlobalRole(user.role) || isVenueScopedRole(user.role)) {
    return clubs;
  }

  if (isClubScopedRole(user.role)) {
    return clubs.filter((club) => canUserViewClub(user, club.id, tenantId));
  }

  return clubs;
}

export function filterClubsForUser(clubs = [], tenantId, user = getCurrentUser()) {
  if (!isRbacEnabled() || !user) {
    return clubs;
  }

  if (isGlobalRole(user.role) || isVenueScopedRole(user.role)) {
    return clubs;
  }

  return clubs.filter((club) => canUserViewClub(user, club.id, tenantId));
}
