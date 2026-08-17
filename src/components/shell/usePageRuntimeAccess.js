import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { resolveRouteAccessScope } from "../../auth/menuAccess.js";
import { usePlatformRuntime } from "../../core/platform/app/usePlatformRuntime.js";
import { buildPageRuntimeAccessState } from "../../core/platform/app/runtimeAccess.js";

/**
 * Shell composition hook — page runtime access using identity RBAC + platform preview fallback.
 * Lives outside Platform Core so Core stays free of context/BM orchestration imports.
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

  const contextKey = JSON.stringify(context);

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
    // contextKey is a stable serialization of `context` for effect identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Wave2 shell move; preserve prior access semantics
  }, [runtime, user, can, rbacEnabled, scope, permission, tenantId, activeClub, activeClubId, contextKey]);

  return { accessAllowed, scope };
}
