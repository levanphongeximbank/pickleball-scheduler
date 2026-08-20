import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { isGlobalRole } from "../../../auth/roles.js";
import { loadClubs } from "../../../data/club.js";
import { listClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { canAccessClub } from "../../../auth/rbac.js";

/**
 * User có quyền xem CLB này không (ngoài RBAC permission).
 * Selected Club is never a grant. VENUE_MANAGER is limited to home Venue clubs.
 * SYSTEM_TECHNICIAN does not inherit all-club visibility.
 */
export function canUserViewClub(user, clubId) {
  if (!user || !clubId) {
    return false;
  }

  if (!isRbacEnabled()) {
    return true;
  }

  const club = loadClubs().find((item) => item.id === clubId) || null;
  return canAccessClub(
    user,
    clubId,
    { venueId: club?.venueId || null },
    { rbacEnabled: true }
  );
}

function listClubsForUserScope(tenantId, user) {
  if (user && isGlobalRole(user.role)) {
    if (!tenantId) {
      return [];
    }
    return listClubsForTenant(tenantId).filter((club) => !club.isDefault);
  }

  return listClubsForTenant(tenantId).filter((club) => !club.isDefault);
}

export function getClubsVisibleToUser(tenantId, user = getCurrentUser()) {
  const clubs = listClubsForUserScope(tenantId, user);

  if (!isRbacEnabled() || !user) {
    return clubs;
  }

  return clubs.filter((club) => canUserViewClub(user, club.id, tenantId));
}

export function filterClubsForUser(clubs = [], tenantId, user = getCurrentUser()) {
  if (!isRbacEnabled() || !user) {
    return clubs;
  }

  return clubs.filter((club) => canUserViewClub(user, club.id, tenantId));
}
