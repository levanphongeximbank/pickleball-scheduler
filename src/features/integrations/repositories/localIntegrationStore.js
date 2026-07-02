import { createDefaultTenantSettings } from "../models/integrationDefaults.js";
import { loadIntegrationSettings, saveIntegrationSettings } from "../storage/integrationStorage.js";

export function createLocalIntegrationStore() {
  return {
    mode: "local",
    readTenantSettings(tenantId) {
      const all = loadIntegrationSettings();
      return all[tenantId] || createDefaultTenantSettings(tenantId);
    },
    writeTenantSettings(tenantId, settings) {
      const all = loadIntegrationSettings();
      all[tenantId] = { ...settings, tenantId };
      saveIntegrationSettings(all);
      return all[tenantId];
    },
    listTenantIds() {
      return Object.keys(loadIntegrationSettings());
    },
  };
}
