import { isGlobalRole, normalizeRole, ROLES } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../../auth/permissions.js";

/** Platform runtime action → identity RBAC permissions (OR). */
export const PLATFORM_TO_IDENTITY_PERMISSIONS = Object.freeze({
  "tenant.manage": [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.VENUE_UPDATE],
  "user.manage": [PERMISSIONS.USER_MANAGE],
  "subscription.manage": [PERMISSIONS.BILLING_MANAGE, PERMISSIONS.SUBSCRIPTION_UPDATE],
  "audit.read": [PERMISSIONS.USER_MANAGE],
  "tournament.manage": [
    PERMISSIONS.TOURNAMENT_UPDATE,
    PERMISSIONS.TOURNAMENT_CREATE,
    PERMISSIONS.TOURNAMENT_VIEW,
  ],
  "club.manage": [PERMISSIONS.CLUB_UPDATE, PERMISSIONS.CLUB_VIEW],
  "booking.manage": [PERMISSIONS.BOOKING_UPDATE, PERMISSIONS.BOOKING_CREATE, PERMISSIONS.BOOKING_VIEW],
  "court.manage": [PERMISSIONS.COURT_UPDATE, PERMISSIONS.COURT_VIEW],
  "player.manage": [PERMISSIONS.PLAYER_UPDATE, PERMISSIONS.PLAYER_VIEW],
  "customer.manage": [PERMISSIONS.CUSTOMER_UPDATE, PERMISSIONS.CUSTOMER_VIEW],
  "checkin.manage": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TOURNAMENT_UPDATE],
  "payment.manage": [PERMISSIONS.FINANCE_EDIT, PERMISSIONS.BILLING_PAYMENT_VIEW],
  "system.setting": [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SYSTEM_SETTING],
  "match.update": [PERMISSIONS.MATCH_UPDATE],
  "match.view": [PERMISSIONS.TOURNAMENT_VIEW],
  "marketplace.manage": [PERMISSIONS.MARKETPLACE_MANAGE, PERMISSIONS.MARKETPLACE_VIEW],
});

const PLATFORM_ROLE_ALIASES = Object.freeze({
  [ROLES.COURT_OWNER]: "TENANT_OWNER",
  [ROLES.VENUE_OWNER]: "TENANT_OWNER",
  TENANT_OWNER: "TENANT_OWNER",
  [ROLES.COURT_MANAGER]: "VENUE_MANAGER",
  [ROLES.VENUE_MANAGER]: "VENUE_MANAGER",
  PLATFORM_ADMIN: "SUPER_ADMIN",
});

export function resolvePlatformRole(role) {
  const canonical = normalizeRole(role);
  if (isGlobalRole(canonical)) {
    return "SUPER_ADMIN";
  }
  return PLATFORM_ROLE_ALIASES[canonical] || PLATFORM_ROLE_ALIASES[role] || canonical || role;
}

/** Map identity Auth user → platform runtime user shape. */
export function mapIdentityUserToPlatformUser(authUser, tenantId) {
  const resolvedTenant =
    tenantId || authUser?.venueId || authUser?.tenantId || null;

  return {
    user_id: authUser?.id || authUser?.user_id || "anonymous",
    tenant_id: resolvedTenant,
    role: resolvePlatformRole(authUser?.role),
    identityRole: normalizeRole(authUser?.role),
  };
}

function resolveIdentityAccess(identityAuth, permission) {
  if (!identityAuth?.rbacEnabled || !identityAuth?.can || !identityAuth?.user) {
    return null;
  }

  if (isGlobalRole(identityAuth.user.role)) {
    return { allowed: true, source: "identity_super_admin" };
  }

  const mapped = PLATFORM_TO_IDENTITY_PERMISSIONS[permission] || [];
  if (mapped.length === 0) {
    return null;
  }

  const scope = identityAuth.scope || {};
  const allowed = mapped.some((perm) => identityAuth.can(perm, scope));
  if (allowed) {
    return { allowed: true, source: "identity_rbac" };
  }

  return { allowed: false, source: "identity_rbac" };
}

export function resolveRuntimeAccess(runtime, user, permission, tenantId, context = {}) {
  if (!runtime?.accessService?.authorize) {
    return {
      allowed: false,
      permission,
      reason: "runtime.access_unavailable",
      context,
    };
  }

  const decision = runtime.accessService.authorize(
    user,
    { tenant_id: tenantId, ...context },
    permission
  );

  return {
    ...decision,
    permission,
    context,
  };
}

/**
 * Resolve page-level runtime access.
 * Prefers identity RBAC (production) over in-memory platform matrix (preview).
 */
export function buildRuntimeAccessState(
  runtime,
  user,
  permission,
  tenantId,
  context = {},
  identityAuth = null
) {
  const identityDecision = resolveIdentityAccess(identityAuth, permission);
  if (identityDecision?.allowed) {
    return {
      allowed: true,
      canAccess: true,
      decision: identityDecision,
      message: null,
    };
  }

  if (identityAuth?.rbacEnabled && identityDecision && !identityDecision.allowed) {
    return {
      allowed: false,
      canAccess: false,
      decision: identityDecision,
      message: "Bạn không có quyền thực hiện hành động này.",
    };
  }

  const decision = resolveRuntimeAccess(runtime, user, permission, tenantId, context);

  return {
    allowed: decision.allowed,
    canAccess: decision.allowed,
    decision,
    message: decision.allowed
      ? null
      : decision.reason || "Bạn không có quyền thực hiện hành động này.",
  };
}

/** Convenience wrapper for pages — uses real auth user + identity RBAC. */
export function buildPageRuntimeAccessState({
  runtime,
  authUser,
  permission,
  tenantId,
  context = {},
  identityAuth = null,
}) {
  const platformUser = mapIdentityUserToPlatformUser(authUser, tenantId);
  return buildRuntimeAccessState(
    runtime,
    platformUser,
    permission,
    tenantId,
    context,
    identityAuth
  );
}
