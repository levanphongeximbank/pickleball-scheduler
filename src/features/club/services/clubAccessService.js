import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { isGlobalRole } from "../../../auth/roles.js";
import { listClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { canAccessClub } from "../../../auth/rbac.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isCanonicalClubRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import { isCanonicalClubReadEnabled } from "../context/clubCanonicalReadModel.js";
import { loadClubs } from "../../../data/club.js";

function isCloudClubAuthority() {
  return isCanonicalClubReadEnabled({
    canonicalEnabled: isCanonicalClubRepositoryEnabled(),
    hasSupabase: hasSupabaseConfig(),
  });
}

/**
 * User có quyền xem CLB này không (ngoài RBAC permission).
 * Selected Club is never a grant. VENUE_MANAGER is limited to home Venue clubs.
 * SYSTEM_TECHNICIAN does not inherit all-club visibility.
 *
 * Cloud/canonical mode: do not load the legacy Club blob to decide authorization.
 * Local/no-cloud compatibility may read the local registry only on that path.
 */
export function canUserViewClub(user, clubId, clubProjection = null) {
  if (!user || !clubId) {
    return false;
  }

  if (!isRbacEnabled()) {
    return true;
  }

  let club = clubProjection && typeof clubProjection === "object" ? clubProjection : null;
  if (!club && !isCloudClubAuthority()) {
    club = loadClubs().find((item) => item.id === clubId) || null;
  }

  return canAccessClub(
    user,
    clubId,
    { venueId: club?.venueId || null, tenantId: club?.tenantId || null },
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

  return clubs.filter((club) => canUserViewClub(user, club.id, club));
}

export function filterClubsForUser(clubs = [], tenantId, user = getCurrentUser()) {
  if (!isRbacEnabled() || !user) {
    return clubs;
  }

  return clubs.filter((club) => canUserViewClub(user, club.id, club));
}
