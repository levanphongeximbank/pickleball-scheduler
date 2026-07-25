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
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { createTrustedBackendHttpMessagingGateway } from "../trustedBackend/createTrustedBackendHttpMessagingGateway.js";
import {
  bootstrapCommunicationRuntime,
  getCommunicationRuntimeStatus,
  resetCommunicationRuntime,
  setCommunicationRuntimeAuthenticated,
} from "./communicationRuntime.js";
import { CommunicationRuntimeContext } from "./communicationRuntimeContext.js";
import { COMMUNICATION_RUNTIME_MODE } from "./constants.js";

function isTrustedBackendHttpEnabled() {
  try {
    const flag = String(
      import.meta.env?.VITE_COMMUNICATION_TRUSTED_BACKEND || ""
    ).toLowerCase();
    return flag === "true" || flag === "1";
  } catch {
    return false;
  }
}

async function resolveAccessToken() {
  const client = getSupabaseAuthClient();
  if (!client) return null;
  let { data } = await client.auth.getSession();
  let token = data?.session?.access_token || null;
  if (!token) {
    const refreshed = await client.auth.refreshSession();
    token = refreshed.data?.session?.access_token || null;
  }
  return token;
}

export function CommunicationRuntimeProvider({ children }) {
  const { user, authLoading } = useAuth();
  const { currentTenantId } = useTenant();
  const { activeClubId } = useClub();
  const [status, setStatus] = useState(() => getCommunicationRuntimeStatus());
  const [bootError, setBootError] = useState(null);
  const [gateway, setGateway] = useState(null);
  const isAuthenticated = Boolean(user?.id);
  const trustedBackendHttp = isTrustedBackendHttpEnabled();

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
        // Explicit opt-in only — never silent demo fallback when wiring missing.
        productionDependenciesCertified:
          trustedBackendHttp && isAuthenticated && Boolean(user?.id),
        createProductionGateway:
          trustedBackendHttp && isAuthenticated && user?.id
            ? async (opts) =>
                createTrustedBackendHttpMessagingGateway({
                  actorParticipantId: opts.actorParticipantId || user.id,
                  tenantId: opts.tenantId || null,
                  clubId: opts.clubId || null,
                  getAccessToken: resolveAccessToken,
                })
            : undefined,
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
    trustedBackendHttp,
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
