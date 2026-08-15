import { isGlobalRole, isPlatformScopedRole } from "../../../auth/roles.js";
import { normalizeTenant } from "../../../models/tenant.js";
import { resolveEffectiveTenantId } from "./tenantService.js";

export const TENANT_SWITCHER_EMPTY_LABEL = "Chọn tổ chức…";
export const CLUB_DETAIL_MISSING_TENANT_WARNING = "Chưa xác định được tenant.";

/**
 * Tenant switcher UI + switchTenant mutation — SUPER_ADMIN / PLATFORM_ADMIN only.
 * SYSTEM_TECHNICIAN is platform-scoped (view) and must not gain switch permission.
 */
export function canSwitchTenant(user) {
  return Boolean(user && isGlobalRole(user.role));
}

export function canRenderTenantSwitcher(user) {
  return canSwitchTenant(user);
}

/**
 * SA and Platform Tech have no profile venue. They may operate unassigned
 * (no TenantGate lock, no first-tenant auto-pick). This is NOT switch permission.
 */
export function canOperateUnassignedTenant(user) {
  return Boolean(
    user && (isGlobalRole(user.role) || isPlatformScopedRole(user.role))
  );
}

export function buildTenantCatalog(venues = []) {
  const seen = new Set();
  const catalog = [];

  for (const venue of venues) {
    const tenant = normalizeTenant(venue);
    const id = String(tenant.id || "").trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    catalog.push({ ...tenant, id });
  }

  return catalog;
}

export function findCatalogTenant(catalog, tenantId) {
  const id = String(tenantId || "").trim();
  if (!id || !Array.isArray(catalog)) {
    return null;
  }

  return catalog.find((tenant) => tenant.id === id) || null;
}

export function resolvePickerCurrentTenantId({
  rbacEnabled,
  isAuthenticated,
  user,
  adminTenantId = null,
  persistedTenantId = null,
} = {}) {
  if (!rbacEnabled || !isAuthenticated || !user) {
    return null;
  }

  if (canOperateUnassignedTenant(user)) {
    return adminTenantId || persistedTenantId || null;
  }

  return resolveEffectiveTenantId(user);
}

export function resolveTenantSwitcherView({ currentTenantId, tenants = [] } = {}) {
  const hasSelection = tenants.some((tenant) => tenant.id === currentTenantId);
  const value = hasSelection ? currentTenantId : "";
  const selected = value ? findCatalogTenant(tenants, value) : null;
  const selectedLabel = value ? selected?.name || value : TENANT_SWITCHER_EMPTY_LABEL;

  return { value, selectedLabel, hasSelection };
}

export function resolveClubDetailTenantGate(currentTenantId) {
  const tenantId = String(currentTenantId || "").trim();
  if (!tenantId) {
    return {
      blocked: true,
      warning: CLUB_DETAIL_MISSING_TENANT_WARNING,
    };
  }

  return { blocked: false, tenantId };
}

/**
 * After a successful canonical hydrate, drop session ids that are no longer
 * in the catalog. Empty/failed hydrate must not erase an explicit selection.
 */
export function reconcileSessionWithCatalog({
  sessionTenantId,
  catalog = [],
  canonicalHydrateSucceeded = false,
  canonicalIds = [],
} = {}) {
  const current = String(sessionTenantId || "").trim();
  if (!current) {
    return null;
  }

  if (findCatalogTenant(catalog, current)) {
    return current;
  }

  if (
    canonicalHydrateSucceeded &&
    Array.isArray(canonicalIds) &&
    canonicalIds.length > 0
  ) {
    return null;
  }

  return current;
}

export function firstTenantFallbackId(tenants = []) {
  return tenants[0]?.id || null;
}
