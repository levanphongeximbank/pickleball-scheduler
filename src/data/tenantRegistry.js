/**
 * Wave 3 — local Tenant cache (pickleball-tenants-v1).
 *
 * After Phase B cloud bind, this is NOT Tenant identity authority.
 * Canonical identity is public.platform_tenants via platformTenantAuthority.
 * This key may store a projection/cache and the selected-tenant preference
 * lives in tenantSession — never a second Tenant authority.
 */

import { normalizeTenant } from "../models/tenant.js";
import {
  DEMO_SEED_TENANT_IDS,
  shouldHideDemoSeedData,
} from "../demo/seed/demoSeedRegistry.js";
import { PLATFORM_TENANT_CACHE_ROLE } from "../core/platform/app/platformTenantAuthority.js";

const TENANTS_KEY = "pickleball-tenants-v1";

function safeParseArray(raw, fallback = []) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function loadTenants() {
  const tenants = safeParseArray(localStorage.getItem(TENANTS_KEY), []).map(normalizeTenant);
  if (!shouldHideDemoSeedData()) {
    return tenants;
  }
  return tenants.filter((tenant) => !DEMO_SEED_TENANT_IDS.includes(tenant.id));
}

export function saveTenants(tenants) {
  localStorage.setItem(
    TENANTS_KEY,
    JSON.stringify((tenants || []).map(normalizeTenant))
  );
}

/**
 * Replace the local cache from an already-resolved authority list.
 * Does not invent Tenant identity.
 */
export function replaceTenantCache(tenants) {
  saveTenants(tenants);
}

export function upsertTenantRecord(tenant) {
  const normalized = normalizeTenant(tenant);
  if (!normalized.id) {
    return { ok: false, error: "tenant id required" };
  }
  const list = loadTenants();
  const index = list.findIndex((row) => row.id === normalized.id);
  if (index < 0) {
    saveTenants([...list, normalized]);
  } else {
    const next = list.slice();
    next[index] = { ...next[index], ...normalized, id: normalized.id };
    saveTenants(next);
  }
  return { ok: true, tenant: normalized };
}

export function createLocalTenantCacheAdapter() {
  return {
    role: PLATFORM_TENANT_CACHE_ROLE,
    read: loadTenants,
    write: replaceTenantCache,
  };
}
