export const API_CLIENT_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  REVOKED: "revoked",
});

export const API_KEY_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  REVOKED: "revoked",
  EXPIRED: "expired",
});

export function createApiClient(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `ac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(input.name || "API Client").trim(),
    tenantId: input.tenantId || null,
    status: input.status || API_CLIENT_STATUS.ACTIVE,
    createdBy: input.createdBy || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function createApiKeyRecord(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `ak_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    clientId: input.clientId,
    tenantId: input.tenantId || null,
    keyPrefix: input.keyPrefix,
    hashedKey: input.hashedKey,
    scopes: Array.isArray(input.scopes) ? input.scopes : [],
    status: input.status || API_KEY_STATUS.ACTIVE,
    expiresAt: input.expiresAt || null,
    createdBy: input.createdBy || null,
    createdAt: input.createdAt || now,
    lastUsedAt: input.lastUsedAt || null,
  };
}

export function createApiLogRecord(input = {}) {
  return {
    id: input.id || `alog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requestId: input.requestId,
    tenantId: input.tenantId || null,
    apiClientId: input.apiClientId || null,
    method: input.method || "GET",
    path: input.path || "/",
    statusCode: input.statusCode || 200,
    durationMs: input.durationMs || 0,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}
