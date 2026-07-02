import { createDefaultTenantSettings } from "../models/integrationDefaults.js";

export function createMemoryIntegrationStore(seed = {}) {
  const byTenant = new Map(Object.entries(seed));

  return {
    mode: "memory",
    readTenantSettings(tenantId) {
      return byTenant.get(tenantId) || createDefaultTenantSettings(tenantId);
    },
    writeTenantSettings(tenantId, settings) {
      const next = { ...settings, tenantId };
      byTenant.set(tenantId, next);
      return next;
    },
    listTenantIds() {
      return [...byTenant.keys()];
    },
    clear() {
      byTenant.clear();
    },
  };
}
