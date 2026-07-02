import { EDGE_API_ERROR_CODES } from "../constants/edgeApiErrors.js";
import { hasApiScope } from "../constants/apiScopes.js";
import { API_CLIENT_STATUS, API_KEY_STATUS } from "../models/apiModels.js";
import {
  getApiClient,
  listApiKeys,
} from "../services/apiKeyService.js";
import { loadApiKeys } from "../storage/apiStorage.js";
import { hashApiKey, parseApiKeyPrefix, verifyApiKey } from "../utils/hashKey.js";
import {
  API_KEY_AUDIT_ACTIONS,
  recordApiKeyAudit,
} from "../services/apiKeyAuditService.js";

function isKeyExpired(keyRecord, now = Date.now()) {
  if (keyRecord.status === API_KEY_STATUS.EXPIRED) return true;
  if (!keyRecord.expiresAt) return false;
  return new Date(keyRecord.expiresAt).getTime() <= now;
}

async function findKeyByPlain(plainKey) {
  const prefix = parseApiKeyPrefix(plainKey);
  if (!prefix) return null;

  const hashed = await hashApiKey(plainKey);
  const candidates = loadApiKeys().filter((k) => k.keyPrefix === prefix);
  for (const candidate of candidates) {
    const match = await verifyApiKey(plainKey, candidate.hashedKey);
    if (match) {
      return { keyRecord: candidate, hashed };
    }
  }
  return null;
}

/**
 * Phase 11C — API key guard for Edge router.
 * Never persists or logs raw API keys.
 */
export async function guardApiKey(plainKey, { requiredScope = null, tenantId = null } = {}) {
  if (!plainKey || typeof plainKey !== "string") {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      meta: { reason: "missing_key" },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.UNAUTHORIZED,
      message: "Thiếu API key.",
      statusCode: 401,
    };
  }

  const found = await findKeyByPlain(plainKey);
  if (!found) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      meta: { reason: "invalid_key" },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key không hợp lệ.",
      statusCode: 401,
    };
  }

  const { keyRecord } = found;

  if (keyRecord.status === API_KEY_STATUS.REVOKED) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { reason: "revoked" },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key đã bị thu hồi.",
      statusCode: 401,
    };
  }

  if (isKeyExpired(keyRecord)) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { reason: "expired" },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key đã hết hạn.",
      statusCode: 401,
    };
  }

  if (keyRecord.status !== API_KEY_STATUS.ACTIVE) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { reason: "inactive", status: keyRecord.status },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key không hoạt động.",
      statusCode: 401,
    };
  }

  const client = getApiClient(keyRecord.clientId);
  if (!client || client.status !== API_CLIENT_STATUS.ACTIVE) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { reason: "client_inactive" },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API client không hoạt động.",
      statusCode: 401,
    };
  }

  if (tenantId && keyRecord.tenantId !== tenantId) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { reason: "tenant_mismatch", requestedTenant: tenantId },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.TENANT_NOT_FOUND,
      message: "API key không thuộc tenant này.",
      statusCode: 403,
    };
  }

  if (requiredScope && !hasApiScope(keyRecord.scopes, requiredScope)) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.SCOPE_DENIED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { requiredScope },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.SCOPE_DENIED,
      message: `Thiếu scope: ${requiredScope}`,
      statusCode: 403,
    };
  }

  recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.USED, {
    tenantId: keyRecord.tenantId,
    keyId: keyRecord.id,
    clientId: keyRecord.clientId,
    meta: { scope: requiredScope || null },
  });

  return {
    ok: true,
    tenantId: keyRecord.tenantId,
    scopes: keyRecord.scopes,
    apiKey: keyRecord,
    client,
    mode: "api_key",
  };
}

/** Assert tenant from route/query matches authenticated key tenant. */
export function assertEdgeTenant(auth, requestedTenantId) {
  if (!auth?.ok) return auth;
  if (!requestedTenantId) return auth;
  if (auth.tenantId !== requestedTenantId) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.DENIED, {
      tenantId: auth.tenantId,
      keyId: auth.apiKey?.id,
      clientId: auth.client?.id,
      meta: { reason: "cross_tenant_access", requestedTenant: requestedTenantId },
    });
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.FORBIDDEN,
      message: "Không được truy cập tenant khác.",
      statusCode: 403,
    };
  }
  return auth;
}

export function listSanitizedApiKeys(options) {
  return listApiKeys(options);
}
