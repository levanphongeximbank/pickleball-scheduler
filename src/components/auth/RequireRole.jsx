import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { hasAnyRole } from "../auth/rbac.js";

/**
 * Route guard — yêu cầu một trong các role.
 */
export default function RequireRole({
  roles = [],
  fallback = null,
  redirectTo = null,
  children,
}) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();

  if (!rbacEnabled || !isAuthenticated) {
    return children;
  }

  if (hasAnyRole(user, roles)) {
    return children;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return fallback;
}
