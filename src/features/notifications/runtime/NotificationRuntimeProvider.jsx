/**
 * Phase 1.4 — NotificationRuntimeProvider
 * Bootstraps repository + identity when auth/tenant are ready.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import {
  bootstrapNotificationRuntime,
  getNotificationRuntimeStatus,
  setNotificationRuntimeAuthenticated,
} from "./notificationRuntime.js";
import { NotificationRuntimeContext } from "./notificationRuntimeContext.js";

export function NotificationRuntimeProvider({ children }) {
  const { user, authLoading } = useAuth();
  const { currentTenantId } = useTenant();
  const [status, setStatus] = useState(() => getNotificationRuntimeStatus());
  const [bootError, setBootError] = useState(null);
  const isAuthenticated = Boolean(user?.id);

  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;

    const run = async () => {
      setNotificationRuntimeAuthenticated(isAuthenticated);
      const result = await bootstrapNotificationRuntime({
        authenticated: isAuthenticated,
        tenantId: currentTenantId || user?.venueId || null,
        allowUnverifiedUserIds: false,
      });
      if (cancelled) return;
      setStatus(result.status || getNotificationRuntimeStatus());
      setBootError(result.ok ? null : result.error || null);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user?.id, user?.venueId, currentTenantId]);

  const value = useMemo(
    () => ({
      status,
      bootError,
      tenantId: currentTenantId || user?.venueId || null,
      userId: user?.id || null,
    }),
    [status, bootError, currentTenantId, user?.id, user?.venueId]
  );

  return (
    <NotificationRuntimeContext.Provider value={value}>
      {children}
    </NotificationRuntimeContext.Provider>
  );
}
