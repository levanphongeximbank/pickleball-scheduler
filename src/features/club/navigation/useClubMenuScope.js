import { useMemo } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { resolveRouteAccessScope } from "../../../auth/menuAccess.js";
import { buildClubNavContext } from "../navigation/clubNavMatrix.js";
import { useMyClubMembershipFromContext } from "../hooks/MyClubMembershipContext.jsx";

/**
 * Shared menu scope for desktop sidebar, mobile drawer, and global search.
 */
export function useClubMenuScope() {
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();
  const { currentTenantId } = useTenant();
  const membership = useMyClubMembershipFromContext();

  return useMemo(() => {
    const base = resolveRouteAccessScope({
      user: auth.user,
      activeClubId,
      activeClub,
    });
    const clubNav =
      auth.isAuthenticated && auth.user
        ? buildClubNavContext({
            user: auth.user,
            membership,
            can: auth.can,
            tenantId: currentTenantId,
          })
        : null;

    return {
      ...base,
      clubNav,
      membershipClubId: membership?.clubId || null,
    };
  }, [
    activeClub,
    activeClubId,
    auth.can,
    auth.isAuthenticated,
    auth.user,
    currentTenantId,
    membership,
  ]);
}
