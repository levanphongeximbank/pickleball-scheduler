import { getActiveClubId } from "../../../data/club.js";
import {
  clearActiveTenantId,
  loadActiveTenantId,
  saveActiveTenantId,
} from "../../../data/tenantSession.js";
import { saveVenues } from "../../../data/venue.js";
import { switchActiveClub } from "../../../domain/clubService.js";
import { invalidateClubRegistryCache } from "../../club/registry/clubRegistryCache.js";
import { quarantineOfflineQueueForTenantSwitch } from "../../mobile/services/offlineQueueQuarantine.js";
import {
  hydrateSupabaseVenuesToLocalRegistry,
  resolveTenantRecord,
} from "./profileVenueService.js";
import { getPrimaryClubIdForTenant, getTenantById, listTenants } from "./tenantService.js";
import {
  buildTenantCatalog,
  canOperateUnassignedTenant,
  canRenderTenantSwitcher,
  canSwitchTenant,
  findCatalogTenant,
  reconcileSessionWithCatalog,
  resolveClubDetailTenantGate,
  resolvePickerCurrentTenantId,
  resolveTenantSwitcherView,
} from "./tenantSelectionModel.js";

function resolveSwitchableTenant(tenantId, catalog = []) {
  const trimmed = String(tenantId || "").trim();
  if (!trimmed) {
    return null;
  }

  return findCatalogTenant(catalog, trimmed) || getTenantById(trimmed);
}

/**
 * Single application transition for Super Admin tenant switching.
 * Session commit happens first; post-switch side effects cannot roll it back.
 */
export function commitTenantSwitch({
  tenantId,
  user = null,
  catalog = [],
  remapLegacyClub = false,
} = {}) {
  if (!canSwitchTenant(user)) {
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

  const tenant = resolveSwitchableTenant(trimmed, catalog);
  if (!tenant) {
    return { ok: false, error: "Không tìm thấy tenant.", code: "TENANT_NOT_FOUND" };
  }

  saveActiveTenantId(trimmed, user?.id);

  let clubId = null;
  try {
    invalidateClubRegistryCache({ tenantId: trimmed });
    quarantineOfflineQueueForTenantSwitch(trimmed);

    if (remapLegacyClub) {
      clubId = getPrimaryClubIdForTenant(trimmed);
      if (clubId && getActiveClubId() !== clubId) {
        switchActiveClub(clubId);
      }
    }
  } catch {
    // Active tenant is already committed. Side effects must not leave a half-applied UI.
  }

  return { ok: true, tenantId: trimmed, clubId, tenant };
}

export function readSelectableTenantCatalog() {
  return buildTenantCatalog(listTenants());
}

/**
 * Headless TenantProvider + TenantSwitcher + ClubDetail consumer.
 * Used by unit tests to reproduce the selection lifecycle without a browser.
 */
export function createTenantSelectionRuntime({
  user = null,
  rbacEnabled = true,
  isAuthenticated = true,
  catalog = null,
} = {}) {
  let currentUser = user;
  let rbac = Boolean(rbacEnabled);
  let auth = Boolean(isAuthenticated);
  let tenantCatalog = Array.isArray(catalog)
    ? buildTenantCatalog(catalog)
    : readSelectableTenantCatalog();
  let adminTenantId = loadActiveTenantId(currentUser?.id || null);

  function snapshot() {
    const persistedTenantId = loadActiveTenantId(currentUser?.id || null);
    const currentTenantId = resolvePickerCurrentTenantId({
      rbacEnabled: rbac,
      isAuthenticated: auth,
      user: currentUser,
      adminTenantId,
      persistedTenantId,
    });
    const view = resolveTenantSwitcherView({
      currentTenantId,
      tenants: tenantCatalog,
    });
    const currentTenant = currentTenantId
      ? findCatalogTenant(tenantCatalog, currentTenantId) ||
        resolveTenantRecord(currentTenantId, currentUser)
      : null;

    return {
      currentTenantId,
      currentTenant,
      catalog: tenantCatalog,
      adminTenantId,
      ...view,
      clubDetail: resolveClubDetailTenantGate(currentTenantId),
      canSwitchTenant: canSwitchTenant(currentUser),
      canRenderTenantSwitcher: canRenderTenantSwitcher(currentUser),
      canOperateUnassignedTenant: canOperateUnassignedTenant(currentUser),
    };
  }

  return {
    getState: snapshot,
    switchTenant(tenantId) {
      const result = commitTenantSwitch({
        tenantId,
        user: currentUser,
        catalog: tenantCatalog,
      });
      if (result.ok) {
        adminTenantId = result.tenantId;
      }
      return result;
    },
    remount() {
      tenantCatalog = readSelectableTenantCatalog().length
        ? readSelectableTenantCatalog()
        : tenantCatalog;
      adminTenantId = loadActiveTenantId(currentUser?.id || null);
      return snapshot();
    },
    authSemanticRefresh() {
      return snapshot();
    },
    rerender() {
      return snapshot();
    },
    replaceUser(nextUser, { isAuthenticated: nextAuth = true, rbacEnabled: nextRbac = rbac } = {}) {
      currentUser = nextUser;
      auth = Boolean(nextAuth);
      rbac = Boolean(nextRbac);
      adminTenantId = loadActiveTenantId(currentUser?.id || null);
      return snapshot();
    },
    logout() {
      clearActiveTenantId();
      currentUser = null;
      auth = false;
      adminTenantId = null;
      return snapshot();
    },
    async hydrate(client) {
      const result = await hydrateSupabaseVenuesToLocalRegistry(client);
      tenantCatalog = readSelectableTenantCatalog();
      const nextId = reconcileSessionWithCatalog({
        sessionTenantId: adminTenantId,
        catalog: tenantCatalog,
        canonicalHydrateSucceeded: Boolean(result?.ok),
        canonicalIds: result?.tenantIds,
      });
      if (nextId !== adminTenantId) {
        adminTenantId = nextId;
        if (!nextId) {
          clearActiveTenantId();
        }
      }
      return result;
    },
    wipeLocalRegistryKeepingCatalog() {
      saveVenues([]);
    },
    setCatalog(nextCatalog) {
      tenantCatalog = buildTenantCatalog(nextCatalog);
    },
  };
}
