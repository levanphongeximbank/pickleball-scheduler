import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

/**
 * Route guard — yêu cầu permission.
 * Khi RBAC tắt hoặc chưa đăng nhập → cho qua (giữ hành vi cũ).
 */
export default function RequirePermission({
  permission,
  permissions,
  mode = "any",
  scope = {},
  fallback = null,
  redirectTo = null,
  children,
}) {
  const { can, canAll, canAny, rbacEnabled, isAuthenticated } = useAuth();

  if (!rbacEnabled || !isAuthenticated) {
    return children;
  }

  const list = permissions || (permission ? [permission] : []);
  const allowed =
    mode === "all" ? canAll(list, scope) : list.length === 1 ? can(list[0], scope) : canAny(list, scope);

  if (allowed) {
    return children;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return fallback;
}
