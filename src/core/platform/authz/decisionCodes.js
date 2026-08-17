/**
 * Wave 4 — stable authorization / readiness decision codes.
 *
 * These are internal kernel codes. UI may map them; it must not collapse
 * UNAUTHENTICATED, UNAUTHORIZED, CONTEXT_UNRESOLVED, or AUTHORITY_UNAVAILABLE
 * into an empty dataset.
 */

export const AUTHZ_DECISION = Object.freeze({
  ALLOW: "ALLOW",
  DENY: "DENY",
});

export const AUTHZ_CODE = Object.freeze({
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNAUTHORIZED: "UNAUTHORIZED",
  IDENTITY_INCOMPLETE: "IDENTITY_INCOMPLETE",
  IDENTITY_INACTIVE: "IDENTITY_INACTIVE",
  ENTITLEMENT_MISSING: "ENTITLEMENT_MISSING",
  TENANT_OPERATIONAL_ENTITLEMENT_MISSING: "TENANT_OPERATIONAL_ENTITLEMENT_MISSING",
  TENANT_CONTEXT_ONLY: "TENANT_CONTEXT_ONLY",
  ENTITLEMENT_UNAVAILABLE: "ENTITLEMENT_UNAVAILABLE",
  AUTHORITY_UNAVAILABLE: "AUTHORITY_UNAVAILABLE",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  RPC_NOT_CONFIGURED: "RPC_NOT_CONFIGURED",
  RESOURCE_SCOPE_MISMATCH: "RESOURCE_SCOPE_MISMATCH",
  TARGET_REQUIRED: "TARGET_REQUIRED",
  CONTEXT_UNRESOLVED: "CONTEXT_UNRESOLVED",
  RESOURCE_NOT_CONFIGURED: "RESOURCE_NOT_CONFIGURED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  EMPTY_DATASET: "EMPTY_DATASET",
  NETWORK_FAILURE: "NETWORK_FAILURE",
  RBAC_CONFIG_DENIED: "RBAC_CONFIG_DENIED",
  ALLOW: "ALLOW",
});

export const ENTITLEMENT_KIND = Object.freeze({
  GLOBAL_PLATFORM_ADMIN: "GLOBAL_PLATFORM_ADMIN",
  TENANT_OWNER: "TENANT_OWNER",
  TENANT_MEMBER: "TENANT_MEMBER",
  HOME_VENUE: "HOME_VENUE",
  CLUB_MEMBER: "CLUB_MEMBER",
  CLUB_GOVERNANCE: "CLUB_GOVERNANCE",
});

export const ENTITLEMENT_STATUS = Object.freeze({
  UNBOUND: "UNBOUND",
  PENDING: "PENDING",
  READY: "READY",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  AUTHORITY_UNAVAILABLE: "AUTHORITY_UNAVAILABLE",
});

export function createAuthzDecision({
  allowed,
  code,
  reason = null,
  evidenceKind = null,
} = {}) {
  return Object.freeze({
    allowed: Boolean(allowed),
    decision: allowed ? AUTHZ_DECISION.ALLOW : AUTHZ_DECISION.DENY,
    code: code || (allowed ? AUTHZ_CODE.ALLOW : AUTHZ_CODE.UNAUTHORIZED),
    reason: reason || null,
    evidenceKind: evidenceKind || null,
  });
}

export function allowDecision(code = AUTHZ_CODE.ALLOW, extras = {}) {
  return createAuthzDecision({ allowed: true, code, ...extras });
}

export function denyDecision(code, extras = {}) {
  return createAuthzDecision({ allowed: false, code, ...extras });
}
