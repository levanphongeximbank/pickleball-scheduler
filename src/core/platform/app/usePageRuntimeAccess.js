import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { resolveRouteAccessScope } from "../../../auth/menuAccess.js";
import { usePlatformRuntime } from "./usePlatformRuntime.js";
import { buildPageRuntimeAccessState } from "./runtimeAccess.js";

/**
 * Resolve page runtime access using identity RBAC (production) + platform preview fallback.
 */
export function usePageRuntimeAccess(permission, tenantId, context = {}) {
  const runtime = usePlatformRuntime();
  const { user, can, rbacEnabled } = useAuth();
  const { activeClubId, activeClub } = useClub();
  const [accessAllowed, setAccessAllowed] = useState(true);

  const scope = useMemo(
    () =>
      resolveRouteAccessScope({
        user,
        activeClubId,
        activeClub,
      }),
    [user, activeClubId, activeClub]
  );

  useEffect(() => {
    try {
      const resolvedTenantId =
        tenantId || activeClub?.tenantId || activeClub?.venueId || user?.venueId || activeClubId;
      const accessState = buildPageRuntimeAccessState({
        runtime,
        authUser: user,
        permission,
        tenantId: resolvedTenantId,
        context,
        identityAuth: { user, can, rbacEnabled, scope },
      });
      setAccessAllowed(accessState.allowed);
    } catch {
      setAccessAllowed(false);
    }
  }, [runtime, user, can, rbacEnabled, scope, permission, tenantId, activeClub, activeClubId, JSON.stringify(context)]);

  return { accessAllowed, scope };
}
