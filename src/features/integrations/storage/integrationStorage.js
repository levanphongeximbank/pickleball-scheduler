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

export function loadIntegrationSettings() {
  return readJson(SETTINGS_KEY, {});
}

export function saveIntegrationSettings(settings) {
  writeJson(SETTINGS_KEY, settings || {});
}

export function getTenantIntegrationSettings(tenantId) {
  const all = loadIntegrationSettings();
  return all[tenantId] || createDefaultTenantSettings(tenantId);
}

export function saveTenantIntegrationSettings(tenantId, patch) {
  const all = loadIntegrationSettings();
  const current = all[tenantId] || createDefaultTenantSettings(tenantId);
  all[tenantId] = {
    ...current,
    ...patch,
    tenantId,
    updatedAt: new Date().toISOString(),
  };
  saveIntegrationSettings(all);
  return all[tenantId];
}

export function createDefaultTenantSettings(tenantId) {
  return {
    tenantId,
    defaultPaymentProvider: "mock",
    vnpayEnabled: false,
    momoEnabled: false,
    stripeEnabled: false,
    mockPaymentEnabled: true,
    zaloEnabled: false,
    emailEnabled: false,
    smsEnabled: false,
    zaloConfig: {
      oaId: "",
      appId: "",
      status: "inactive",
      lastConnectedAt: null,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function clearIntegrationStorage() {
  localStorage.removeItem(SETTINGS_KEY);
}
