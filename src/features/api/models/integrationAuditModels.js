import { INTEGRATION_AUDIT_EVENTS } from "../constants/integrationAudit.js";
import { EDGE_API_ERROR_CODES } from "../constants/edgeApiErrors.js";

const FORBIDDEN_METADATA_KEYS = new Set([
  "plainKey",
  "plain_key",
  "x-api-key",
  "x_api_key",
  "hashed_key",
  "hashedKey",
  "hashSecret",
  "secretKey",
  "accessKey",
  "secret",
  "pass",
  "password",
  "apiKey",
  "apiSecret",
  "webhookSecret",
  "service_role",
  "serviceRole",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

/** Strip secrets from audit metadata — never persist raw API keys or hashes. */
export function sanitizeAuditMetadata(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditMetadata);
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_METADATA_KEYS.has(key)) {
      continue;
    }
    out[key] = sanitizeAuditMetadata(child);
  }
  return out;
}

export function buildIntegrationAuditEntry({
  eventType,
  requestId = null,
  tenantId = null,
  apiClientId = null,
  apiKeyId = null,
  keyPrefix = null,
  route = null,
  method = null,
  statusCode = null,
  resultCode = null,
  scopeRequired = null,
  scopesGranted = [],
  metadata = {},
} = {}) {
  return {
    eventType,
    requestId,
    tenantId,
    apiClientId,
    apiKeyId,
    keyPrefix,
    route,
    method,
    statusCode,
    resultCode,
    scopeRequired,
    scopesGranted: Array.isArray(scopesGranted) ? scopesGranted : [],
    metadata: sanitizeAuditMetadata(metadata),
    createdAt: new Date().toISOString(),
  };
}

export function serializeIntegrationAuditRow(entry) {
  return {
    request_id: entry.requestId || null,
    tenant_id: entry.tenantId || null,
    api_client_id: entry.apiClientId || null,
    api_key_id: entry.apiKeyId || null,
    key_prefix: entry.keyPrefix || null,
    event_type: entry.eventType,
    route: entry.route || null,
    method: entry.method || null,
    status_code: entry.statusCode ?? null,
    result_code: entry.resultCode || null,
    scope_required: entry.scopeRequired || null,
    scopes_granted: entry.scopesGranted || [],
    metadata: entry.metadata || {},
    created_at: entry.createdAt || new Date().toISOString(),
  };
}

/**
 * Resolve audit event_type for a finished edge request (single row per request).
 */
export function resolveIntegrationAuditEventType({
  routePath,
  method,
  authOk,
  resultCode,
} = {}) {
  if (!routePath) return null;

  if (!authOk) {
    if (resultCode === EDGE_API_ERROR_CODES.SCOPE_DENIED) {
      return INTEGRATION_AUDIT_EVENTS.API_KEY_SCOPE_DENIED;
    }
    return INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED;
  }

  if (method === "GET" && routePath === "/integrations") {
    return INTEGRATION_AUDIT_EVENTS.INTEGRATION_READ;
  }
  if (method === "POST" && /^\/integrations\/[^/]+\/test-write$/.test(routePath)) {
    return INTEGRATION_AUDIT_EVENTS.INTEGRATION_WRITE;
  }
  if (method === "GET" && routePath === "/webhooks/test") {
    return INTEGRATION_AUDIT_EVENTS.WEBHOOK_READ;
  }
  if (method === "POST" && routePath === "/webhooks/test") {
    return INTEGRATION_AUDIT_EVENTS.WEBHOOK_WRITE;
  }

  return INTEGRATION_AUDIT_EVENTS.API_KEY_USED;
}
