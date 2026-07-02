import { EDGE_API_ERROR_CODES } from "../constants/edgeApiErrors.js";
import { hasApiScope } from "../constants/apiScopes.js";
import { API_CLIENT_STATUS, API_KEY_STATUS } from "../models/apiModels.js";
import { listApiKeys } from "../services/apiKeyService.js";
import { hashApiKey, parseApiKeyPrefix, verifyApiKey } from "../utils/hashKey.js";
import {
  ApiKeyStoreConfigError,
  findApiKeyByPlain,
  scheduleApiKeyLastUsedUpdate,
} from "../storage/apiKeyStore.js";

function isKeyExpired(keyRecord, now = Date.now()) {
  if (keyRecord.status === API_KEY_STATUS.EXPIRED) return true;
  if (!keyRecord.expiresAt) return false;
  return new Date(keyRecord.expiresAt).getTime() <= now;
}

function sanitizeKeyForAuth(keyRecord) {
  if (!keyRecord) return null;
  const { hashedKey: _hash, ...safe } = keyRecord;
  void _hash;
  return safe;
}

function buildAuditContext({
  tenantId = null,
  clientId = null,
  keyId = null,
  keyPrefix = null,
  scopesGranted = [],
  scopeRequired = null,
  denyReason = null,
  metadata = {},
} = {}) {
  return {
    tenantId,
    apiClientId: clientId,
    apiKeyId: keyId,
    keyPrefix,
    scopesGranted: Array.isArray(scopesGranted) ? scopesGranted : [],
    scopeRequired,
    denyReason,
    metadata,
  };
}

/**
 * Phase 11C/11D/11E — API key guard for Edge router.
 * Never persists or logs raw API keys. Audit context only — insert at router finish().
 */
export async function guardApiKey(plainKey, { requiredScope = null, tenantId = null } = {}) {
  if (!plainKey || typeof plainKey !== "string") {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.UNAUTHORIZED,
      message: "Thiếu API key.",
      statusCode: 401,
      auditContext: buildAuditContext({
        scopeRequired: requiredScope,
        denyReason: "missing_key",
      }),
    };
  }

  let found;
  try {
    found = await findApiKeyByPlain(plainKey);
  } catch (error) {
    if (error instanceof ApiKeyStoreConfigError) {
      return {
        ok: false,
        code: EDGE_API_ERROR_CODES.INTERNAL_ERROR,
        message: error.message,
        statusCode: 503,
      };
    }
    throw error;
  }

  if (!found) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key không hợp lệ.",
      statusCode: 401,
      auditContext: buildAuditContext({
        scopeRequired: requiredScope,
        keyPrefix: parseApiKeyPrefix(plainKey) || null,
        denyReason: "invalid_key",
      }),
    };
  }

  const { keyRecord, client: resolvedClient } = found;

  if (keyRecord.status === API_KEY_STATUS.REVOKED) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key đã bị thu hồi.",
      statusCode: 401,
      auditContext: buildAuditContext({
        tenantId: keyRecord.tenantId,
        clientId: keyRecord.clientId,
        keyId: keyRecord.id,
        keyPrefix: keyRecord.keyPrefix,
        scopesGranted: keyRecord.scopes,
        scopeRequired: requiredScope,
        denyReason: "revoked",
      }),
    };
  }

  if (isKeyExpired(keyRecord)) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key đã hết hạn.",
      statusCode: 401,
      auditContext: buildAuditContext({
        tenantId: keyRecord.tenantId,
        clientId: keyRecord.clientId,
        keyId: keyRecord.id,
        keyPrefix: keyRecord.keyPrefix,
        scopesGranted: keyRecord.scopes,
        scopeRequired: requiredScope,
        denyReason: "expired",
      }),
    };
  }

  if (keyRecord.status !== API_KEY_STATUS.ACTIVE) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API key không hoạt động.",
      statusCode: 401,
      auditContext: buildAuditContext({
        tenantId: keyRecord.tenantId,
        clientId: keyRecord.clientId,
        keyId: keyRecord.id,
        keyPrefix: keyRecord.keyPrefix,
        scopesGranted: keyRecord.scopes,
        scopeRequired: requiredScope,
        denyReason: "inactive",
        metadata: { status: keyRecord.status },
      }),
    };
  }

  const client = resolvedClient;
  if (!client || client.status !== API_CLIENT_STATUS.ACTIVE) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.INVALID_API_KEY,
      message: "API client không hoạt động.",
      statusCode: 401,
      auditContext: buildAuditContext({
        tenantId: keyRecord.tenantId,
        clientId: keyRecord.clientId,
        keyId: keyRecord.id,
        keyPrefix: keyRecord.keyPrefix,
        scopesGranted: keyRecord.scopes,
        scopeRequired: requiredScope,
        denyReason: "client_inactive",
      }),
    };
  }

  if (tenantId && keyRecord.tenantId !== tenantId) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.TENANT_NOT_FOUND,
      message: "API key không thuộc tenant này.",
      statusCode: 403,
      auditContext: buildAuditContext({
        tenantId: keyRecord.tenantId,
        clientId: keyRecord.clientId,
        keyId: keyRecord.id,
        keyPrefix: keyRecord.keyPrefix,
        scopesGranted: keyRecord.scopes,
        scopeRequired: requiredScope,
        denyReason: "tenant_mismatch",
        metadata: { requestedTenant: tenantId },
      }),
    };
  }

  if (requiredScope && !hasApiScope(keyRecord.scopes, requiredScope)) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.SCOPE_DENIED,
      message: `Thiếu scope: ${requiredScope}`,
      statusCode: 403,
      auditContext: buildAuditContext({
        tenantId: keyRecord.tenantId,
        clientId: keyRecord.clientId,
        keyId: keyRecord.id,
        keyPrefix: keyRecord.keyPrefix,
        scopesGranted: keyRecord.scopes,
        scopeRequired: requiredScope,
        denyReason: "scope_denied",
      }),
    };
  }

  scheduleApiKeyLastUsedUpdate(keyRecord.id);

  return {
    ok: true,
    tenantId: keyRecord.tenantId,
    scopes: keyRecord.scopes,
    apiKey: sanitizeKeyForAuth(keyRecord),
    client,
    mode: "api_key",
    auditContext: buildAuditContext({
      tenantId: keyRecord.tenantId,
      clientId: keyRecord.clientId,
      keyId: keyRecord.id,
      keyPrefix: keyRecord.keyPrefix,
      scopesGranted: keyRecord.scopes,
      scopeRequired: requiredScope,
    }),
  };
}

/** Assert tenant from route/query matches authenticated key tenant. */
export function assertEdgeTenant(auth, requestedTenantId) {
  if (!auth?.ok) return auth;
  if (!requestedTenantId) return auth;
  if (auth.tenantId !== requestedTenantId) {
    return {
      ok: false,
      code: EDGE_API_ERROR_CODES.FORBIDDEN,
      message: "Không được truy cập tenant khác.",
      statusCode: 403,
      auditContext: {
        ...(auth.auditContext || {}),
        denyReason: "cross_tenant_access",
        metadata: {
          ...(auth.auditContext?.metadata || {}),
          requestedTenant: requestedTenantId,
        },
      },
    };
  }
  return auth;
}

export function listSanitizedApiKeys(options) {
  return listApiKeys(options);
}

// Re-export for tests that assert hash behavior on guard path.
export { hashApiKey, verifyApiKey, parseApiKeyPrefix };
