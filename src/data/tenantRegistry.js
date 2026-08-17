/**
 * Wave 3 — durable local tenant registry (distinct from venue registry).
 */

import { normalizeTenant } from "../models/tenant.js";
import {
  DEMO_SEED_TENANT_IDS,
  shouldHideDemoSeedData,
} from "../demo/seed/demoSeedRegistry.js";

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
