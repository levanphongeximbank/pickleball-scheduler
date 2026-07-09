import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";

/**
 * Fail-closed gate: chỉ render children khi RBAC bật và user là Super Admin (PLATFORM_ADMIN).
 */
export default function SuperAdminFeatureGate({ children, fallback = null }) {
  const { rbacEnabled } = useAuth();
  const { isSuperAdmin } = useTenant();

  if (!rbacEnabled || !isSuperAdmin) {
    return fallback;
  }

  return children;
}
