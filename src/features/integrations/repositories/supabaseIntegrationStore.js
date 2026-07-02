import { createDefaultTenantSettings } from "../models/integrationDefaults.js";
import {
  deserializeTenantSettingsRow,
  serializeTenantSettingsRow,
} from "./integrationRowMap.js";

const TABLE = "tenant_integration_settings";

export function createSupabaseIntegrationStore(client, { cache = {} } = {}) {
  if (!client) {
    throw new Error("Supabase client required for supabase integration store");
  }

  const byTenant = { ...cache };
  const dirtyTenants = new Set();

  return {
    mode: "supabase",
    client,
    readTenantSettings(tenantId) {
      return byTenant[tenantId] || createDefaultTenantSettings(tenantId);
    },
    writeTenantSettings(tenantId, settings, { updatedBy = null } = {}) {
      const next = {
        ...createDefaultTenantSettings(tenantId),
        ...settings,
        tenantId,
        updatedAt: new Date().toISOString(),
      };
      byTenant[tenantId] = next;
      dirtyTenants.add(tenantId);
      this.__lastUpdatedBy = updatedBy;
      return next;
    },
    listTenantIds() {
      return Object.keys(byTenant);
    },
    markDirty(tenantId) {
      dirtyTenants.add(tenantId);
    },
    getDirtyTenants() {
      return [...dirtyTenants];
    },
    clearDirty(tenantId) {
      if (tenantId) {
        dirtyTenants.delete(tenantId);
        return;
      }
      dirtyTenants.clear();
    },
    async hydrateTenant(tenantId) {
      const { data, error } = await client
        .from(TABLE)
        .select("tenant_id, settings, updated_at, updated_by")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        byTenant[tenantId] = deserializeTenantSettingsRow(data);
      } else {
        byTenant[tenantId] = createDefaultTenantSettings(tenantId);
      }
      return byTenant[tenantId];
    },
    async hydrateAll() {
      const { data, error } = await client
        .from(TABLE)
        .select("tenant_id, settings, updated_at, updated_by");

      if (error) {
        throw error;
      }

      for (const row of data || []) {
        byTenant[row.tenant_id] = deserializeTenantSettingsRow(row);
      }
      return byTenant;
    },
    async persistTenant(tenantId, { updatedBy = null } = {}) {
      const settings = byTenant[tenantId];
      if (!settings) {
        return { table: TABLE, upserted: 0 };
      }

      const row = serializeTenantSettingsRow(tenantId, settings, {
        updatedBy: updatedBy || this.__lastUpdatedBy || null,
      });

      const { error } = await client.from(TABLE).upsert(row, { onConflict: "tenant_id" });
      if (error) {
        throw error;
      }
      dirtyTenants.delete(tenantId);
      return { table: TABLE, upserted: 1 };
    },
    async flushDirty(tenantIds) {
      const targets = tenantIds?.length ? [...new Set(tenantIds)] : [...dirtyTenants];
      const persisted = [];
      const errors = [];

      for (const tenantId of targets) {
        try {
          persisted.push(await this.persistTenant(tenantId));
        } catch (error) {
          errors.push({
            tenantId,
            message: error?.message || String(error),
          });
        }
      }

      return { ok: errors.length === 0, persisted, errors };
    },
  };
}
