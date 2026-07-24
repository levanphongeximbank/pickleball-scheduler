/**
 * CommunicationRuntimeProvider (COMMS-07).
 *
 * Mirrors NotificationRuntimeProvider convention:
 * - reads useAuth + useTenant + useClub
 * - bootstraps once auth settles
 * - exposes { status, bootError, gateway, mode, ... }
 * - resets runtime on unmount (no duplicate lingering gateway)
 */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import {
  bootstrapCommunicationRuntime,
  getCommunicationRuntimeStatus,
  resetCommunicationRuntime,
  setCommunicationRuntimeAuthenticated,
} from "./communicationRuntime.js";
import { CommunicationRuntimeContext } from "./communicationRuntimeContext.js";
import { COMMUNICATION_RUNTIME_MODE } from "./constants.js";

export function CommunicationRuntimeProvider({ children }) {
  const { user, authLoading } = useAuth();
  const { currentTenantId } = useTenant();
  const { activeClubId } = useClub();
  const [status, setStatus] = useState(() => getCommunicationRuntimeStatus());
  const [bootError, setBootError] = useState(null);
  const [gateway, setGateway] = useState(null);
  const isAuthenticated = Boolean(user?.id);

  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;

    const run = async () => {
      setCommunicationRuntimeAuthenticated(isAuthenticated);
      const result = await bootstrapCommunicationRuntime({
        authenticated: isAuthenticated,
        actorParticipantId: user?.id || null,
        tenantId: currentTenantId || user?.venueId || null,
        clubId: activeClubId || user?.clubId || null,
        searchParams:
          typeof window !== "undefined"
            ? window.location?.search || ""
            : null,
      });
      if (cancelled) return;
      setStatus(result.status || getCommunicationRuntimeStatus());
      setGateway(result.gateway || null);
      setBootError(result.ok ? null : result.error || null);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    isAuthenticated,
    user?.id,
    user?.venueId,
    user?.clubId,
    currentTenantId,
    activeClubId,
  ]);

  useEffect(() => {
    return () => {
      resetCommunicationRuntime();
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      bootError,
      gateway,
      mode: status?.mode || COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
      tenantId: currentTenantId || user?.venueId || null,
      clubId: activeClubId || user?.clubId || null,
      userId: user?.id || null,
      unavailable:
        (status?.mode || COMMUNICATION_RUNTIME_MODE.UNAVAILABLE) ===
        COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
      isDemo: status?.mode === COMMUNICATION_RUNTIME_MODE.DEMO,
      isProduction: status?.mode === COMMUNICATION_RUNTIME_MODE.PRODUCTION,
    }),
    [
      status,
      bootError,
      gateway,
      currentTenantId,
      user?.id,
      user?.venueId,
      user?.clubId,
      activeClubId,
    ]
  );

  return (
    <CommunicationRuntimeContext.Provider value={value}>
      {children}
    </CommunicationRuntimeContext.Provider>
  );
}
