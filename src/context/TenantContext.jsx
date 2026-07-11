import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext.jsx";
import { isGlobalRole, isClubScopedRole, isPlatformScopedRole } from "../auth/roles.js";
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
  hydrateSupabaseVenuesToLocalRegistry,
  resolveTenantRecord,
} from "../features/tenant/services/profileVenueService.js";
import { getTenantById } from "../features/tenant/index.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";
import {
  assertSubscriptionOperational,
  runSubscriptionMaintenance,
} from "../features/billing/bridges/subscriptionAccessBridge.js";
import {
  BILLING_STORE_MODES,
  getBillingStore,
  resolveBillingStoreMode,
} from "../features/billing/repositories/billingRepository.js";
import {
  ensureBillingStoreHydrated,
  resetBillingStoreHydration,
} from "../features/billing/repositories/billingStoreRuntime.js";
import { syncLegacySubscriptionsFromBilling } from "../domain/venueService.js";
import { isSubscriptionOperationalExemptRole } from "../features/billing/guards/operationalRoutePolicy.js";
import { invalidateClubRegistryCache } from "../features/club/registry/clubRegistryCache.js";
import { quarantineOfflineQueueForTenantSwitch } from "../features/mobile/services/offlineQueueQuarantine.js";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const [adminTenantId, setAdminTenantId] = useState(() => loadActiveTenantId());
  const [revision, setRevision] = useState(0);

  const isSuperAdmin = Boolean(user && isGlobalRole(user.role));
  const isPlatformTech = Boolean(user && isPlatformScopedRole(user.role));
  const canPickTenant = isSuperAdmin || isPlatformTech;

  const currentTenantId = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !user) {
      return null;
    }

    if (canPickTenant) {
      return adminTenantId || loadActiveTenantId() || null;
    }

    return resolveEffectiveTenantId(user);
  }, [adminTenantId, canPickTenant, isAuthenticated, rbacEnabled, user]);

  const currentTenant = useMemo(() => {
    if (!currentTenantId) {
      return null;
    }

    return resolveTenantRecord(currentTenantId, user);
  }, [currentTenantId, revision, user]);

  const userId = user?.id || null;
  const userClubId = user?.clubId || null;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      ensureTenantBootstrap();

      if (
        resolveBillingStoreMode() === BILLING_STORE_MODES.SUPABASE &&
        rbacEnabled &&
        isAuthenticated &&
        userId
      ) {
        const store = getBillingStore();
        resetBillingStoreHydration(store);
        await ensureBillingStoreHydrated(store);
        syncLegacySubscriptionsFromBilling();
      }

      if (cancelled) {
        return;
      }

      runSubscriptionMaintenance();
      setRevision((value) => value + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, rbacEnabled, userId]);

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
    if (!rbacEnabled || !isAuthenticated || !userId || !canPickTenant || !hasSupabaseConfig()) {
      return;
    }

    let cancelled = false;

    void hydrateSupabaseVenuesToLocalRegistry().then((result) => {
      if (!cancelled && result?.ok) {
        setRevision((value) => value + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canPickTenant, isAuthenticated, rbacEnabled, userId]);

  useEffect(() => {
    if (!rbacEnabled || !isAuthenticated || !userId || !currentTenantId) {
      return;
    }

    const clubScoped = Boolean(user?.role && isClubScopedRole(user.role));
    const clubId = isSuperAdmin
      ? getPrimaryClubIdForTenant(currentTenantId)
      : clubScoped
        ? userClubId
        : userClubId || getPrimaryClubIdForTenant(currentTenantId);

    if (clubId && getActiveClubId() !== clubId) {
      switchActiveClub(clubId);
    }
  }, [currentTenantId, isAuthenticated, isSuperAdmin, rbacEnabled, user, userClubId, userId]);

  // Phase 42K — SA must explicitly pick tenant (no listTenants()[0] fallback).

  const tenantCheck = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !user) {
      return { ok: true };
    }

    if (canPickTenant) {
      if (!currentTenantId) {
        return { ok: true };
      }
      const operational = assertTenantOperational(currentTenantId, { user });
      if (!operational.ok) {
        return { ok: true, warning: operational.error, code: operational.code };
      }
      return operational;
    }

    if (!currentTenantId) {
      // CLB/VĐV/huấn luyện — không bắt buộc gán tenant venue (đồng bộ operationalRoutePolicy).
      if (isSubscriptionOperationalExemptRole(user)) {
        return { ok: true, code: "TENANT_UNASSIGNED" };
      }

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
  }, [canPickTenant, currentTenantId, isAuthenticated, rbacEnabled, user]);

  const subscriptionCheck = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !user || !currentTenantId) {
      return { ok: true };
    }

    if (isSuperAdmin || isPlatformTech) {
      return { ok: true };
    }

    if (isSubscriptionOperationalExemptRole(user)) {
      return { ok: true };
    }

    return assertSubscriptionOperational(currentTenantId);
  }, [currentTenantId, isAuthenticated, isPlatformTech, isSuperAdmin, rbacEnabled, revision, user]);

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
      invalidateClubRegistryCache({ tenantId: trimmed });
      quarantineOfflineQueueForTenantSwitch(trimmed);

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
