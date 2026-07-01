import { Navigate, useLocation } from "react-router-dom";
import { usePlatformRuntime } from "../app/usePlatformRuntime.js";

export default function RouteGuard({ children, permission, tenantId, user }) {
  const runtime = usePlatformRuntime();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const decision = runtime.accessService.authorize(
    user,
    { tenant_id: tenantId || user.tenant_id },
    permission
  );

  if (!decision.allowed) {
    return <Navigate to="/403" state={{ from: location }} replace />;
  }

  return children;
}
