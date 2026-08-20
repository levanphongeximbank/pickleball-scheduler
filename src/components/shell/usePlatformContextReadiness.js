import { useMemo } from "react";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { useVenue } from "../../context/VenueContext.jsx";
import { canOperateUnassignedTenant } from "../../features/tenant/services/tenantSelectionModel.js";
import { CLUB_READ_STATE } from "../../features/club/context/clubCanonicalReadModel.js";
import {
  filterClubsForSelectedOperationalTenant,
  resolvePlatformContextReadiness,
} from "../../core/platform/app/platformContextReadiness.js";

/**
 * Shell composition hook — reads Auth/Tenant/Venue/Club contexts for Platform readiness.
 * Lives outside Platform Core so Core stays free of Business Module imports.
 * requireVenue defaults false — Venue is never a global shell requirement.
 */
export function usePlatformContextReadiness({
  requireClub = true,
  requireVenue = false,
} = {}) {
  const { authLoading, isAuthenticated, rbacEnabled, user } = useAuth();
  const { currentTenantId, tenantCheck } = useTenant();
  const { currentVenueId, venues, venueCheck } = useVenue();
  const {
    clubs,
    activeClub,
    activeClubReady,
    canonicalClubRead,
    clubReadState,
    clubReadError,
  } = useClub();

  return useMemo(() => {
    const canOperateWithoutTenant = canOperateUnassignedTenant(user);
    const clubReadLoading =
      Boolean(canonicalClubRead) && clubReadState === CLUB_READ_STATE.LOADING;
    const clubReadFailed =
      Boolean(canonicalClubRead) && clubReadState === CLUB_READ_STATE.ERROR;

    const scopedClubs = currentTenantId
      ? filterClubsForSelectedOperationalTenant(clubs, currentTenantId)
      : canOperateWithoutTenant
        ? []
        : Array.isArray(clubs)
          ? clubs
          : [];

    return resolvePlatformContextReadiness({
      authLoading,
      isAuthenticated,
      rbacEnabled,
      tenantCheck,
      selectedTenantId: currentTenantId,
      canOperateWithoutTenant,
      clubReadLoading,
      clubReadError: clubReadFailed,
      clubReadErrorCode: clubReadError || null,
      eligibleClubs: scopedClubs,
      activeClub,
      activeClubReady,
      requireClub,
      requireVenue,
      venueCheck,
      selectedVenueId: currentVenueId,
      eligibleVenueCount: Array.isArray(venues) ? venues.length : 0,
      organizationConfigured: false,
    });
  }, [
    authLoading,
    isAuthenticated,
    rbacEnabled,
    user,
    currentTenantId,
    tenantCheck,
    currentVenueId,
    venues,
    venueCheck,
    clubs,
    activeClub,
    activeClubReady,
    canonicalClubRead,
    clubReadState,
    clubReadError,
    requireClub,
    requireVenue,
  ]);
}
