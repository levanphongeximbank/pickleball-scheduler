import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext.jsx";
import { buildClubRehydrateScopeKey } from "../auth/authSemanticScope.js";
import { isGlobalRole, isClubScopedRole, isPlatformScopedRole } from "../auth/roles.js";
import { clearActiveTenantId, loadActiveTenantId } from "../data/tenantSession.js";
import { getActiveClubId } from "../data/club.js";
import { switchActiveClub } from "../domain/clubService.js";
import {
  assertTenantOperational,
  canUserAccessTenant,
  ensureTenantBootstrap,
  getPrimaryClubIdForTenant,
} from "../features/tenant/index.js";
import {
  hydrateProfileVenueToLocalRegistry,
  hydrateSupabaseVenuesToLocalRegistry,
  resolveTenantRecord,
} from "../features/tenant/services/profileVenueService.js";
import {
  commitTenantSwitch,
  readSelectableTenantCatalog,
} from "../features/tenant/services/tenantSelectionService.js";
import {
  canOperateUnassignedTenant,
  canSwitchTenant,
  findCatalogTenant,
  reconcileSessionWithCatalog,
  resolvePickerCurrentTenantId,
} from "../features/tenant/services/tenantSelectionModel.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";
import { getBillingAccessCapability } from "../core/platform/app/billingAccessCapability.js";
import { isCanonicalClubRepositoryEnabled } from "../features/club/config/canonicalRepositoryFlags.js";
import { isCanonicalClubReadEnabled } from "../features/club/context/clubCanonicalReadModel.js";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const clubRehydrateScopeKey = buildClubRehydrateScopeKey(user);
  const userId = user?.id || null;
  const [adminTenantId, setAdminTenantId] = useState(() => loadActiveTenantId(userId));
  const [tenantCatalog, setTenantCatalog] = useState(() => readSelectableTenantCatalog());
  const [revision, setRevision] = useState(0);

  // When canonical club read is ON, ClubContext owns activeClub selection from
  // the canonical repository. Do not let the legacy club registry drive club
  // existence, club→tenant mapping, or active-club validation here.
  const canonicalClubRead = isCanonicalClubReadEnabled({
    canonicalEnabled: isCanonicalClubRepositoryEnabled(),
    hasSupabase: hasSupabaseConfig(),
  });

  const isSuperAdmin = Boolean(user && isGlobalRole(user.role));
  const isPlatformTech = Boolean(user && isPlatformScopedRole(user.role));
  // Unassigned-tenant navigation for SA + Platform Tech. Switch permission is SA only.
  const canPickTenant = canOperateUnassignedTenant(user);

  const currentTenantId = useMemo(() => {
    return resolvePickerCurrentTenantId({
      rbacEnabled,
      isAuthenticated,
      user,
      adminTenantId,
      persistedTenantId: userId ? loadActiveTenantId(userId) : null,
    });
    // user is read from the current render; identity key avoids TOKEN_REFRESHED churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- semantic scope, not object identity
  }, [adminTenantId, canPickTenant, isAuthenticated, rbacEnabled, clubRehydrateScopeKey, userId]);

  const currentTenant = useMemo(() => {
    if (!currentTenantId) {
      return null;
    }

    return (
      findCatalogTenant(tenantCatalog, currentTenantId) ||
      resolveTenantRecord(currentTenantId, user)
    );
  }, [currentTenantId, tenantCatalog, user]);

  const userClubId = user?.clubId || null;

  useEffect(() => {
    setAdminTenantId(userId ? loadActiveTenantId(userId) : null);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const billing = getBillingAccessCapability();

    void (async () => {
      ensureTenantBootstrap();

      await billing.ensureSessionReady({
        rbacEnabled,
        isAuthenticated,
        userId,
      });

      if (cancelled) {
        return;
      }

      billing.runMaintenance();
      setTenantCatalog((current) => {
        const registry = readSelectableTenantCatalog();
        if (!current.length) {
          return registry;
        }
        const merged = new Map(current.map((row) => [row.id, row]));
        for (const row of registry) {
          merged.set(row.id, row);
        }
        return [...merged.values()];
      });
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
      if (cancelled || !result?.ok) {
        return;
      }

      const nextCatalog = readSelectableTenantCatalog();
      setTenantCatalog(nextCatalog);
      setAdminTenantId((current) => {
        const next = reconcileSessionWithCatalog({
          sessionTenantId: current,
          catalog: nextCatalog,
          canonicalHydrateSucceeded: true,
          canonicalIds: result.tenantIds,
        });
        if (!next && current && userId) {
          clearActiveTenantId();
        }
        return next;
      });
      setRevision((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [canPickTenant, isAuthenticated, rbacEnabled, userId]);

  useEffect(() => {
    if (!rbacEnabled || !isAuthenticated || !userId || !currentTenantId) {
      return;
    }

    // Canonical mode: ClubContext + canonical repository are the active-club
    // authority. Legacy getPrimaryClubIdForTenant must not overwrite a
    // tenant-bearing canonical preference with a tenant-less registry club.
    if (canonicalClubRead) {
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
  }, [
    canonicalClubRead,
    currentTenantId,
    isAuthenticated,
    isSuperAdmin,
    rbacEnabled,
    user,
    userClubId,
    userId,
  ]);

  // Phase 42K — SA must explicitly pick tenant (no first-tenant auto-selection).

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
      const billing = getBillingAccessCapability();
      if (billing.isExemptRole(user)) {
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

    const billing = getBillingAccessCapability();
    if (billing.isExemptRole(user)) {
      return { ok: true };
    }

    // Fail-closed when billing authority is required but unbound.
    return billing.assertOperational(currentTenantId);
  }, [currentTenantId, isAuthenticated, isPlatformTech, isSuperAdmin, rbacEnabled, revision, user]);

  const switchTenant = useCallback(
    (tenantId) => {
      const result = commitTenantSwitch({
        tenantId,
        user,
        catalog: tenantCatalog,
        remapLegacyClub: !canonicalClubRead,
      });
      if (result.ok) {
        setAdminTenantId(result.tenantId);
        setRevision((value) => value + 1);
      }
      return result;
    },
    [canonicalClubRead, tenantCatalog, user]
  );

  const refreshTenant = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({
      currentTenant,
      currentTenantId,
      tenants: tenantCatalog,
      tenantCheck,
      subscriptionCheck,
      isSuperAdmin,
      canSwitchTenant: canSwitchTenant(user),
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
      tenantCatalog,
      tenantCheck,
      user,
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
