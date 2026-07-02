/** Phase 11A — API key lifecycle audit event types (design; persistence Phase 11B). */
export const API_KEY_AUDIT_ACTIONS = Object.freeze({
  CREATED: "api_key.created",
  ROTATED: "api_key.rotated",
  REVOKED: "api_key.revoked",
  AUTH_SUCCESS: "api_key.auth_success",
  AUTH_FAILED: "api_key.auth_failed",
  SCOPE_DENIED: "api_key.scope_denied",
});

export function buildApiKeyAuditEntry(action, { tenantId, clientId, keyId, actorId, meta = {} }) {
  return {
    action,
    tenantId: tenantId || null,
    clientId: clientId || null,
    keyId: keyId || null,
    actorId: actorId || null,
    meta,
    createdAt: new Date().toISOString(),
  };
}
