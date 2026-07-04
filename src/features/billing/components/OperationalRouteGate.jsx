import { useLocation } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import {
  DEFAULT_OPERATIONAL_ACTION,
  isBillingExemptPath,
} from "../guards/operationalRoutePolicy.js";
import TenantOperationalGate from "./TenantOperationalGate.jsx";

/**
 * Layout-level gate: locks operational routes when tenant subscription is not active.
 * Billing, profile and error pages remain accessible.
 */
export default function OperationalRouteGate({ children, action = DEFAULT_OPERATIONAL_ACTION }) {
  const location = useLocation();
  const { rbacEnabled, isAuthenticated } = useAuth();
  const { isSuperAdmin } = useTenant();

  if (!rbacEnabled || !isAuthenticated || isSuperAdmin) {
    return children;
  }

  if (isBillingExemptPath(location.pathname)) {
    return children;
  }

  return <TenantOperationalGate action={action}>{children}</TenantOperationalGate>;
}
