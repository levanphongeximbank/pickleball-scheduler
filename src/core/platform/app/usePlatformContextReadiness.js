import { useMemo } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { canOperateUnassignedTenant } from "../../../features/tenant/services/tenantSelectionModel.js";
import { CLUB_READ_STATE } from "../../../features/club/context/clubCanonicalReadModel.js";
import {
  filterClubsForSelectedOperationalTenant,
  resolvePlatformContextReadiness,
} from "./platformContextReadiness.js";

/**
 * Shared Platform Context readiness for App Shell + Business Module consumers.
 * Composes existing Auth/Tenant/Club contexts — does not create a second state authority.
 */
export function usePlatformContextReadiness({ requireClub = true } = {}) {
  const { authLoading, isAuthenticated, rbacEnabled, user } = useAuth();
  const { currentTenantId, tenantCheck } = useTenant();
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
      organizationConfigured: false,
    });
  }, [
    authLoading,
    isAuthenticated,
    rbacEnabled,
    user,
    currentTenantId,
    tenantCheck,
    clubs,
    activeClub,
    activeClubReady,
    canonicalClubRead,
    clubReadState,
    clubReadError,
    requireClub,
  ]);
}
