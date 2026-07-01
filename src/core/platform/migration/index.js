import { createTenantEntity } from "../domain/index.js";

export function migrateLegacyV4Payload(payload = {}) {
  const tenant = createTenantEntity({
    id: payload.tenant_id || payload.id || payload.clubId,
    tenant_id: payload.tenant_id || payload.id || payload.clubId,
    name: payload.name || payload.clubName || "Migrated tenant",
    plan: payload.plan || "trial",
    status: payload.status || "active",
  });

  return {
    tenant,
    subscription: {
      tenant_id: tenant.tenant_id,
      plan: tenant.plan,
      status: tenant.status,
      feature_flags: payload.feature_flags || {},
    },
    users: Array.isArray(payload.users)
      ? payload.users.map((user) => ({
          id: user.user_id || user.id,
          user_id: user.user_id || user.id,
          email: user.email || "",
          role: user.role || "PLAYER",
          tenant_id: tenant.tenant_id,
        }))
      : [],
  };
}

export function buildMigrationPlan(payload = {}) {
  const migrated = migrateLegacyV4Payload(payload);

  return {
    source: payload.source || "legacy-v4",
    target: "core-platform-v5",
    tenantId: migrated.tenant.tenant_id,
    summary: {
      tenant: migrated.tenant.name,
      users: migrated.users.length,
      plan: migrated.tenant.plan,
    },
  };
}
