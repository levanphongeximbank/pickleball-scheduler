import { useMemo } from "react";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { resolveRouteAccessScope } from "../../features/tenant/services/profileVenueService.js";

/**
 * Ẩn UI khi không đủ quyền. RBAC tắt hoặc chưa đăng nhập → luôn hiện.
 */
export default function PermissionGate({
  permission,
  permissions,
  mode = "any",
  scope = {},
  children,
  fallback = null,
}) {
  const { can, canAll, canAny, rbacEnabled, isAuthenticated, user } = useAuth();
  const { activeClubId, activeClub } = useClub();

  const resolvedScope = useMemo(() => {
    const base = resolveRouteAccessScope({
      user,
      activeClubId,
      activeClub,
    });

    return {
      ...base,
      clubId: scope.clubId ?? base.clubId,
      venueId: scope.venueId ?? base.venueId,
      tenantId: scope.tenantId ?? base.tenantId,
      playerId: scope.playerId ?? user?.playerId ?? null,
    };
  }, [
    user,
    activeClubId,
    activeClub,
    scope.clubId,
    scope.venueId,
    scope.tenantId,
    scope.playerId,
  ]);

  if (!rbacEnabled || !isAuthenticated) {
    return children;
  }

  const list = permissions || (permission ? [permission] : []);
  if (list.length === 0) {
    return children;
  }

  const allowed =
    mode === "all"
      ? canAll(list, resolvedScope)
      : list.length === 1
        ? can(list[0], resolvedScope)
        : canAny(list, resolvedScope);

  return allowed ? children : fallback;
}
