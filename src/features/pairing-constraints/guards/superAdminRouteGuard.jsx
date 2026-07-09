import { Navigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";

/**
 * Route guard: redirect non–Super Admin to /403 when RBAC is enabled.
 */
export default function SuperAdminRouteGuard({ children }) {
  const { rbacEnabled } = useAuth();
  const { isSuperAdmin } = useTenant();

  if (rbacEnabled && !isSuperAdmin) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
