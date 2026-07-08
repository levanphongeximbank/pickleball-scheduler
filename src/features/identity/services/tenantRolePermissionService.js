import { normalizeRole } from "../constants/roles.js";
import {
  applyTenantOverrides,
  diffOverridesFromEffective,
  getDefaultPermissionsSet,
} from "../constants/rolePermissionUiConfig.js";

const STORAGE_PREFIX = "pickleball-tenant-role-overrides-v1";

function storageKey(tenantId) {
  return `${STORAGE_PREFIX}::${tenantId || "default"}`;
}

function loadStore(tenantId) {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(tenantId, store) {
  localStorage.setItem(storageKey(tenantId), JSON.stringify(store));
}

export function getTenantRoleOverrides(tenantId, role) {
  const canonical = normalizeRole(role);
  const store = loadStore(tenantId);
  const entry = store[canonical];

  if (!entry || typeof entry !== "object") {
    return { added: [], removed: [] };
  }

  return {
    added: Array.isArray(entry.added) ? [...entry.added] : [],
    removed: Array.isArray(entry.removed) ? [...entry.removed] : [],
  };
}

export function getEffectivePermissionsForTenantRole(tenantId, role) {
  const defaults = getDefaultPermissionsSet(role);
  const overrides = getTenantRoleOverrides(tenantId, role);
  return applyTenantOverrides(defaults, overrides);
}

export function saveTenantRoleOverrides(tenantId, role, effectivePermissionSet) {
  const canonical = normalizeRole(role);
  const defaults = getDefaultPermissionsSet(canonical);
  const overrides = diffOverridesFromEffective(defaults, effectivePermissionSet);

  const store = loadStore(tenantId);

  if (overrides.added.length === 0 && overrides.removed.length === 0) {
    delete store[canonical];
  } else {
    store[canonical] = overrides;
  }

  saveStore(tenantId, store);

  return { ok: true, overrides };
}

export function clearTenantRoleOverrides(tenantId, role) {
  const canonical = normalizeRole(role);
  const store = loadStore(tenantId);
  delete store[canonical];
  saveStore(tenantId, store);
  return { ok: true };
}
