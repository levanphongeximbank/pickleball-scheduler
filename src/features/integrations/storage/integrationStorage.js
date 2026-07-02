import { createDefaultTenantSettings } from "../models/integrationDefaults.js";
import { getIntegrationStore } from "../repositories/integrationStoreRuntime.js";

const SETTINGS_KEY = "pickleball-integration-settings-v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Legacy localStorage bulk read — used by local store mode only. */
export function loadIntegrationSettings() {
  return readJson(SETTINGS_KEY, {});
}

export function saveIntegrationSettings(settings) {
  writeJson(SETTINGS_KEY, settings || {});
}

export function getTenantIntegrationSettings(tenantId) {
  const store = getIntegrationStore();
  return store.readTenantSettings(tenantId);
}

export function saveTenantIntegrationSettings(tenantId, patch) {
  const store = getIntegrationStore();
  const current = store.readTenantSettings(tenantId);
  const next = {
    ...current,
    ...patch,
    tenantId,
    updatedAt: new Date().toISOString(),
  };
  return store.writeTenantSettings(tenantId, next);
}

export { createDefaultTenantSettings };

export function clearIntegrationStorage() {
  const store = getIntegrationStore();
  if (typeof store.clear === "function") {
    store.clear();
  }
  localStorage.removeItem(SETTINGS_KEY);
}
