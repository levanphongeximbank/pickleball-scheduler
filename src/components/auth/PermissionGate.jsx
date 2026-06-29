import { useMemo } from "react";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";

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
  const { can, canAll, canAny, rbacEnabled, isAuthenticated } = useAuth();
  const { activeClubId, activeClub } = useClub();

  const resolvedScope = useMemo(
    () => ({
      clubId: scope.clubId ?? activeClubId,
      venueId: scope.venueId ?? activeClub?.venueId ?? null,
      playerId: scope.playerId ?? null,
    }),
    [scope.clubId, scope.venueId, scope.playerId, activeClubId, activeClub?.venueId]
  );

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
