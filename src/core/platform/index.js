export function createTenantRecord({ name, tenant_id, plan = "trial", status = "active" } = {}) {
  return {
    id: tenant_id || `tenant-${Date.now()}`,
    tenant_id: tenant_id || `tenant-${Date.now()}`,
    name: name || "Unnamed tenant",
    plan,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createUserRecord({ email, role, tenant_id, user_id } = {}) {
  return {
    id: user_id || `user-${Date.now()}`,
    user_id: user_id || `user-${Date.now()}`,
    email,
    role,
    tenant_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function assertTenantAccess(user, { tenant_id } = {}) {
  if (!user) {
    return { ok: false, allowed: false, code: "TENANT_REQUIRED" };
  }

  if (user.role === "SUPER_ADMIN" || user.role === "PLATFORM_ADMIN") {
    return { ok: true, allowed: true };
  }

  if (!tenant_id) {
    return { ok: false, allowed: false, code: "TENANT_REQUIRED" };
  }

  if (!user.tenant_id || user.tenant_id !== tenant_id) {
    return { ok: false, allowed: false, code: "TENANT_FORBIDDEN" };
  }

  return { ok: true, allowed: true };
}

export function canPerformAction(user, scope = {}, permission) {
  const tenantCheck = assertTenantAccess(user, scope);
  if (!tenantCheck.ok) {
    return { ok: false, allowed: false, code: tenantCheck.code };
  }

  return { ok: true, allowed: true, permission };
}

const PLATFORM_PERMISSIONS = Object.freeze([
  "tenant.manage",
  "user.manage",
  "subscription.manage",
  "audit.read",
  "tournament.manage",
  "club.manage",
  "booking.manage",
  "court.manage",
  "player.manage",
  "customer.manage",
  "checkin.manage",
  "payment.manage",
  "system.setting",
  "match.update",
  "match.view",
  "marketplace.manage",
  "player.view.self",
  "booking.view.self",
]);

export function getPermissionMatrix() {
  return {
    SUPER_ADMIN: [...PLATFORM_PERMISSIONS],
    TENANT_OWNER: [
      "tenant.manage",
      "user.manage",
      "subscription.manage",
      "audit.read",
      "tournament.manage",
      "club.manage",
      "booking.manage",
      "court.manage",
      "player.manage",
      "customer.manage",
      "checkin.manage",
      "payment.manage",
      "system.setting",
      "match.update",
      "match.view",
      "marketplace.manage",
    ],
    VENUE_MANAGER: [
      "booking.manage",
      "court.manage",
      "player.manage",
      "customer.manage",
      "tournament.manage",
      "checkin.manage",
      "match.update",
      "match.view",
    ],
    CLUB_OWNER: [
      "club.manage",
      "tournament.manage",
      "player.manage",
      "match.update",
      "match.view",
    ],
    STAFF: ["booking.manage", "checkin.manage", "court.manage"],
    CASHIER: ["payment.manage", "booking.manage", "checkin.manage"],
    REFEREE: ["match.update", "match.view", "checkin.manage"],
    PLAYER: ["player.view.self", "booking.view.self", "match.view"],
  };
}

export function getRlsPolicyMatrix() {
  return {
    SUPER_ADMIN: ["all"],
    TENANT_OWNER: ["tenant"],
    VENUE_MANAGER: ["tenant"],
    CLUB_OWNER: ["tenant"],
    STAFF: ["tenant"],
    CASHIER: ["tenant"],
    REFEREE: ["tenant"],
    PLAYER: ["self"],
  };
}

export function createAuditEvent({ tenant_id, actor_user_id, action, entity_type, metadata = {} } = {}) {
  return {
    id: `audit-${Date.now()}`,
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    metadata,
    created_at: new Date().toISOString(),
  };
}

export function createNotification({ tenant_id, user_id, channel, title, body = "" } = {}) {
  return {
    id: `notification-${Date.now()}`,
    tenant_id,
    user_id,
    channel,
    title,
    body,
    created_at: new Date().toISOString(),
  };
}

export function createSubscription({ tenant_id, plan, status = "active", feature_flags = {} } = {}) {
  return {
    id: `subscription-${Date.now()}`,
    tenant_id,
    plan,
    status,
    feature_flags,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createSetting({ tenant_id, key, value, scope = "tenant" } = {}) {
  return {
    id: `setting-${Date.now()}`,
    tenant_id,
    scope,
    key,
    value,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function getCorePlatformSeed() {
  return {
    roles: ["SUPER_ADMIN", "TENANT_OWNER", "VENUE_MANAGER", "CLUB_OWNER", "STAFF", "CASHIER", "REFEREE", "PLAYER"],
    permissions: ["tenant.manage", "user.manage", "subscription.manage", "audit.read", "booking.manage", "court.manage", "player.manage", "checkin.manage", "payment.manage", "match.update", "match.view", "player.view.self", "booking.view.self"],
  };
}

/**
 * Phase 2A — canonical public Platform Core integration surface.
 * Re-exports Phase 1 contracts (no duplicate implementations) and the
 * immutable capability manifest. Legacy scaffold exports above remain for
 * backward compatibility and are not the contract source of truth.
 */
export {
  ok,
  fail,
  isOk,
  isFail,
  normalizeOpaqueId,
  isOpaqueId,
  OPAQUE_ID_ERROR,
  nowIso,
  parseIsoStrict,
  ISO_INSTANT_ERROR,
  createActorReference,
  isActorReference,
  ACTOR_REFERENCE_ERROR,
  createSubjectReference,
  isSubjectReference,
  SUBJECT_REFERENCE_ERROR,
  createSecurityContext,
  isSecurityContext,
  SECURITY_CONTEXT_ERROR,
  createTraceContext,
  isTraceContext,
  TRACE_CONTEXT_ERROR,
  createCommonEventEnvelope,
  isCommonEventEnvelope,
  COMMON_EVENT_ERROR,
  createPlatformScope,
  isPlatformScope,
  PLATFORM_SCOPE_ERROR,
  createAuthorizationDecision,
  isAuthorizationDecision,
  AUTHORIZATION_DECISION_ERROR,
  createRoleCode,
  isRoleCode,
  ROLE_CODE_ERROR,
  createPermissionCode,
  isPermissionCode,
  PERMISSION_CODE_ERROR,
  createAuthorizationRequest,
  isAuthorizationRequest,
  AUTHORIZATION_REQUEST_ERROR,
  createIdempotencyKey,
  isIdempotencyKey,
  IDEMPOTENCY_KEY_ERROR,
  createOperationIdentity,
  isOperationIdentity,
  OPERATION_IDENTITY_ERROR,
  createContractVersion,
  isContractVersion,
  CONTRACT_VERSION_ERROR,
  createCompatibilityDecision,
  isCompatibilityDecision,
  COMPATIBILITY_DECISION_ERROR,
  createPlatformErrorDescriptor,
  isPlatformErrorDescriptor,
  PLATFORM_ERROR_DESCRIPTOR_ERROR,
  createIntegrationPortDescriptor,
  isIntegrationPortDescriptor,
  INTEGRATION_PORT_DESCRIPTOR_ERROR,
  createPlatformCapabilityDescriptor,
  isPlatformCapabilityDescriptor,
  PLATFORM_CAPABILITY_DESCRIPTOR_ERROR,
} from "./contracts/index.js";

export { PLATFORM_CAPABILITY_MANIFEST } from "./capabilities.js";

/**
 * Identity/Tenant adoption adapters — pure projections over already-resolved
 * runtime values. Do not replace Identity/Auth/Tenant runtimes.
 */
export {
  projectIdentityActor,
  IDENTITY_ACTOR_ADAPTER_ERROR,
  projectSecurityContext,
  SECURITY_CONTEXT_ADAPTER_ERROR,
  projectTenantScope,
  TENANT_SCOPE_ADAPTER_ERROR,
  projectPermissionCode,
  PERMISSION_CODE_ADAPTER_ERROR,
  projectAuthorizationRequest,
  AUTHORIZATION_REQUEST_ADAPTER_ERROR,
  projectAuthorizationDecision,
  AUTHORIZATION_DECISION_ADAPTER_ERROR,
} from "./adapters/index.js";

/**
 * Event/Audit adoption adapters — pure projections over already-resolved
 * event and audit values. Do not publish, persist, or replace Event/Audit runtimes.
 */
export {
  projectEventTraceContext,
  EVENT_TRACE_CONTEXT_ADAPTER_ERROR,
  projectCommonEventEnvelope,
  COMMON_EVENT_ENVELOPE_ADAPTER_ERROR,
  projectAuditEventEnvelope,
  AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR,
  projectEventErrorDescriptor,
  EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR,
} from "./adapters/index.js";

/**
 * Operation/Compatibility adoption adapters — pure projections over
 * caller-supplied operation, idempotency, version, and compatibility values.
 * Do not generate IDs, detect duplicates, persist, retry, replay, recover,
 * compare versions, or migrate.
 */
export {
  projectIdempotencyKey,
  IDEMPOTENCY_KEY_ADAPTER_ERROR,
  projectOperationIdentity,
  OPERATION_IDENTITY_ADAPTER_ERROR,
  projectContractVersion,
  CONTRACT_VERSION_ADAPTER_ERROR,
  projectCompatibilityDecision,
  COMPATIBILITY_DECISION_ADAPTER_ERROR,
} from "./adapters/index.js";
