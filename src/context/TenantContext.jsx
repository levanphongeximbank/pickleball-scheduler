import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext.jsx";
import { isGlobalRole } from "../auth/roles.js";
import { loadActiveTenantId, saveActiveTenantId } from "../data/tenantSession.js";
import { getActiveClubId } from "../data/club.js";
import { switchActiveClub } from "../domain/clubService.js";
import {
  assertTenantOperational,
  canUserAccessTenant,
  ensureTenantBootstrap,
  getPrimaryClubIdForTenant,
  listTenants,
  resolveEffectiveTenantId,
} from "../features/tenant/index.js";
import {
  hydrateProfileVenueToLocalRegistry,
  resolveTenantRecord,
} from "../features/tenant/services/profileVenueService.js";
import { getTenantById } from "../features/tenant/index.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";
import {
  assertSubscriptionOperational,
  runSubscriptionMaintenance,
} from "../features/billing/bridges/subscriptionAccessBridge.js";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const [adminTenantId, setAdminTenantId] = useState(() => loadActiveTenantId());
  const [revision, setRevision] = useState(0);

  const isSuperAdmin = Boolean(user && isGlobalRole(user.role));

  const currentTenantId = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !user) {
      return null;
    }

    if (isSuperAdmin) {
      return (
        adminTenantId ||
        loadActiveTenantId() ||
        listTenants()[0]?.id ||
        null
      );
    }

    return resolveEffectiveTenantId(user);
  }, [adminTenantId, isAuthenticated, isSuperAdmin, rbacEnabled, user]);

  const currentTenant = useMemo(() => {
    if (!currentTenantId) {
      return null;
    }

    return resolveTenantRecord(currentTenantId, user);
  }, [currentTenantId, revision, user]);

  useEffect(() => {
    ensureTenantBootstrap();
    runSubscriptionMaintenance();
    setRevision((value) => value + 1);
  }, []);

  const userId = user?.id || null;
  const userClubId = user?.clubId || null;

  useEffect(() => {
    if (!rbacEnabled || !isAuthenticated || !userId || !currentTenantId || !hasSupabaseConfig()) {
      return;
    }

    let cancelled = false;

    void hydrateProfileVenueToLocalRegistry(currentTenantId).then((result) => {
      if (!cancelled && result?.ok && result.hydrated) {
        setRevision((value) => value + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentTenantId, isAuthenticated, rbacEnabled, userId]);

  useEffect(() => {
    if (!rbacEnabled || !isAuthenticated || !userId || !currentTenantId) {
      return;
    }

    const clubId = isSuperAdmin
      ? getPrimaryClubIdForTenant(currentTenantId)
      : userClubId || getPrimaryClubIdForTenant(currentTenantId);
    if (clubId && getActiveClubId() !== clubId) {
      switchActiveClub(clubId);
    }
  }, [currentTenantId, isAuthenticated, isSuperAdmin, rbacEnabled, userClubId, userId]);

  useEffect(() => {
    if (!isSuperAdmin || adminTenantId || !listTenants().length) {
      return;
    }

    const firstTenantId = listTenants()[0].id;
    saveActiveTenantId(firstTenantId);
    setAdminTenantId(firstTenantId);
  }, [adminTenantId, isSuperAdmin]);

  const tenantCheck = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !user) {
      return { ok: true };
    }

    if (isSuperAdmin) {
      return currentTenantId
        ? assertTenantOperational(currentTenantId, { user })
        : { ok: true };
    }

    if (!currentTenantId) {
      return {
        ok: false,
        error: "Tài khoản chưa được gán tenant.",
        code: "TENANT_MISSING",
      };
    }

    if (!canUserAccessTenant(user, currentTenantId)) {
      return {
        ok: false,
        error: "Không có quyền truy cập tenant này.",
        code: "TENANT_FORBIDDEN",
      };
    }

    return assertTenantOperational(currentTenantId, { user });
  }, [currentTenantId, isAuthenticated, isSuperAdmin, rbacEnabled, user]);

  const subscriptionCheck = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !user || !currentTenantId) {
      return { ok: true };
    }

    if (isSuperAdmin) {
      return { ok: true };
    }

    return assertSubscriptionOperational(currentTenantId);
  }, [currentTenantId, isAuthenticated, isSuperAdmin, rbacEnabled, user]);

  const switchTenant = useCallback(
    (tenantId) => {
      if (!isSuperAdmin) {
        return {
          ok: false,
          error: "Chỉ SUPER_ADMIN mới được chuyển tenant.",
          code: "FORBIDDEN",
        };
      }

      const trimmed = String(tenantId || "").trim();
      if (!trimmed) {
        return { ok: false, error: "Tenant không hợp lệ." };
      }

      const tenant = getTenantById(trimmed);
      if (!tenant) {
        return { ok: false, error: "Không tìm thấy tenant." };
      }

      saveActiveTenantId(trimmed);
      setAdminTenantId(trimmed);

      const clubId = getPrimaryClubIdForTenant(trimmed);
      if (clubId && getActiveClubId() !== clubId) {
        switchActiveClub(clubId);
      }

      setRevision((value) => value + 1);
      return { ok: true, tenantId: trimmed, clubId };
    },
    [isSuperAdmin]
  );

  const refreshTenant = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({
      currentTenant,
      currentTenantId,
      tenantCheck,
      subscriptionCheck,
      isSuperAdmin,
      switchTenant,
      refreshTenant,
      revision,
    }),
    [
      currentTenant,
      currentTenantId,
      isSuperAdmin,
      refreshTenant,
      revision,
      switchTenant,
      subscriptionCheck,
      tenantCheck,
    ]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }

  return context;
}

export function useCurrentTenant() {
  return useTenant().currentTenant;
}

export function useCurrentTenantId() {
  return useTenant().currentTenantId;
}
