import { createDefaultTenantSettings } from "../models/integrationDefaults.js";

const SECRET_KEYS = new Set([
  "hashSecret",
  "secretKey",
  "accessKey",
  "secret",
  "pass",
  "password",
  "apiKey",
  "apiSecret",
  "webhookSecret",
  "hashedKey",
]);

function stripSecrets(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stripSecrets);
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) {
      continue;
    }
    out[key] = stripSecrets(child);
  }
  return out;
}

export function serializeTenantSettingsRow(tenantId, settings, { updatedBy = null } = {}) {
  const safe = stripSecrets(settings || createDefaultTenantSettings(tenantId));
  return {
    tenant_id: tenantId,
    settings: {
      ...safe,
      tenantId,
    },
    updated_at: safe.updatedAt || new Date().toISOString(),
    updated_by: updatedBy,
  };
}

export function deserializeTenantSettingsRow(row) {
  if (!row) {
    return null;
  }
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    ...createDefaultTenantSettings(row.tenant_id),
    ...settings,
    tenantId: row.tenant_id,
    updatedAt: row.updated_at || settings.updatedAt || new Date().toISOString(),
  };
}

export function serializeIntegrationAuditRow(entry) {
  return {
    id: entry.id,
    tenant_id: entry.tenantId,
    action: entry.action,
    actor_id: entry.actorId || null,
    meta: stripSecrets(entry.meta || {}),
    created_at: entry.createdAt || new Date().toISOString(),
  };
}

export function deserializeIntegrationAuditRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    action: row.action,
    actorId: row.actor_id,
    meta: row.meta || {},
    createdAt: row.created_at,
  };
}
