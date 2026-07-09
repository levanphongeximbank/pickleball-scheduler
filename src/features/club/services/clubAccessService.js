import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import {
  isClubScopedRole,
  isPlatformWideRole,
  isVenueScopedRole,
} from "../../../auth/roles.js";
import { loadClubs } from "../../../data/club.js";
import { listClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { getClubMembers } from "./clubMemberService.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";

/**
 * User có quyền xem CLB này không (ngoài RBAC permission).
 * - Platform admin / Admin (SYSTEM_TECHNICIAN): toàn hệ thống
 * - Venue roles: toàn tenant
 * - CLUB_OWNER / PLAYER: CLB được gán hoặc là thành viên active
 */
export function canUserViewClub(user, clubId, tenantId) {
  if (!user || !clubId) {
    return true;
  }

  if (!isRbacEnabled()) {
    return true;
  }

  if (isPlatformWideRole(user.role) || isVenueScopedRole(user.role)) {
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

  const members = getClubMembers(clubId, tenantId, { skipGovernanceGuard: true });
  return members.some(
    (m) =>
      m.playerId === user.playerId && m.status === CLUB_MEMBER_STATUSES.ACTIVE
  );
}

function listClubsForUserScope(tenantId, user) {
  if (user && isPlatformWideRole(user.role)) {
    return loadClubs().filter((club) => !club.isDefault);
  }

  return listClubsForTenant(tenantId).filter((club) => !club.isDefault);
}

export function getClubsVisibleToUser(tenantId, user = getCurrentUser()) {
  const clubs = listClubsForUserScope(tenantId, user);

  if (!isRbacEnabled() || !user) {
    return clubs;
  }

  if (isPlatformWideRole(user.role) || isVenueScopedRole(user.role)) {
    return clubs;
  }

  if (isClubScopedRole(user.role)) {
    const visible = clubs.filter((club) => canUserViewClub(user, club.id, tenantId));

    if (user.clubId && !visible.some((club) => club.id === user.clubId)) {
      const assigned = loadClubs().find((club) => club.id === user.clubId && !club.isDefault);
      if (assigned && canUserViewClub(user, assigned.id, tenantId)) {
        return [...visible, assigned];
      }
    }

    return visible;
  }

  return clubs;
}

export function filterClubsForUser(clubs = [], tenantId, user = getCurrentUser()) {
  if (!isRbacEnabled() || !user) {
    return clubs;
  }

  if (isPlatformWideRole(user.role) || isVenueScopedRole(user.role)) {
    return clubs;
  }

  return clubs.filter((club) => canUserViewClub(user, club.id, tenantId));
}
