import { Navigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { resolveOperatorAcceptanceAccess } from "./operatorAcceptanceShared.js";

export default function OperatorAcceptanceRouteGuard({ children }) {
  const { user } = useAuth();
  const { currentTenantId, isSuperAdmin } = useTenant();
  const access = resolveOperatorAcceptanceAccess({
    env: import.meta.env,
    authUser: user,
    sessionUserId: user?.id || null,
    currentTenantId,
    isSuperAdmin,
  });

  if (!access.ok) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
