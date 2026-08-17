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

/**
 * Project selected operational Tenant/Venue id → visible Select value + label.
 * Selected id is authority; catalog/currentTenant are display records only.
 * A valid currentTenantId must not blank merely because catalog is mid-rebuild.
 */
export function resolveTenantSwitcherView({
  currentTenantId,
  tenants = [],
  currentTenant = null,
} = {}) {
  const id = String(currentTenantId || "").trim();
  if (!id) {
    return {
      value: "",
      selectedLabel: TENANT_SWITCHER_EMPTY_LABEL,
      hasSelection: false,
      displayTenant: null,
    };
  }

  const fromCatalog = findCatalogTenant(tenants, id);
  const fromCurrent =
    currentTenant && String(currentTenant.id || "").trim() === id ? currentTenant : null;
  const displayTenant = fromCatalog || fromCurrent || null;
  const label = String(displayTenant?.name || "").trim() || id;

  return {
    value: id,
    selectedLabel: label,
    hasSelection: true,
    displayTenant,
  };
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
