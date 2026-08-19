import {
  ROLES,
  isGlobalRole,
  isClubScopedRole,
  isVenueScopedRole,
  isRefereeRole,
  isPlatformScopedRole,
  isTournamentTeamScopedRole,
  rolesEqual,
  normalizeRole,
} from "./roles.js";
import { getPermissionScopes, PERMISSION_SCOPE, PERMISSIONS } from "./permissions.js";
import { roleHasPermission, classifySystemTechnicianPermission, isSystemTechnicianBusinessCapability } from "./rolePermissions.js";
import { getEffectivePermissionsForTenantRole } from "../features/identity/services/tenantRolePermissionService.js";
import { resolveGovernanceElevatedRole } from "./governanceScopeResolver.js";
import { isUserActive } from "../models/user.js";
import { getClubMetaForAuthz } from "./clubScopeResolver.js";
import {
  canUserAccessCluster,
  isOrgWideClusterRole,
  resolveAssignedClusterIdsForUser,
} from "../features/court-cluster/services/courtClusterService.js";
import { isCourtClustersEnabled } from "../features/court-cluster/config/clusterFlags.js";
import { isSecureRuntime } from "./runtime.js";
import { decideClubMembershipAccess, collectActiveClubEntitlements } from "./clubEntitlementDecision.js";
import { decideTenantAccess } from "../features/tenant/services/tenantAccessDecision.js";
import { requiresTenantOperationalEntitlement } from "../core/platform/authz/tenantOperationalCapability.js";

/**
 * Secure runtime cannot run with RBAC effectively disabled (allow-all).
 * Local non-secure may explicitly run RBAC-off.
 */
export function isRbacConfigurationDenied({ rbacEnabled = false } = {}) {
  return isSecureRuntime() && rbacEnabled === false;
}

/**
 * RBAC có được áp dụng không.
 * Local non-secure + RBAC off → allow-all (legacy local).
 * Secure runtime + RBAC off → fail closed (not allow-all).
 */
export function isRbacEnforced({ rbacEnabled = false, user = null } = {}) {
  if (isRbacConfigurationDenied({ rbacEnabled })) {
    return Boolean(user);
  }
  return Boolean(rbacEnabled && user);
}

export function hasRole(user, role) {
  if (!user?.role) return false;
  return rolesEqual(user.role, role);
}

export function hasAnyRole(user, roles = []) {
  if (!user?.role) return false;
  return roles.some((role) => rolesEqual(user.role, role));
}

/**
 * Kiểm tra role permission, có áp dụng tenant overrides khi user có tenantId/venueId.
 */
export function roleHasEffectivePermission(user, permission) {
  const role = resolveGovernanceElevatedRole(user) || normalizeRole(user?.role);
  if (!role) {
    return false;
  }

  const tenantId = user?.tenantId || null;
  if (tenantId) {
    return getEffectivePermissionsForTenantRole(tenantId, role).has(permission);
  }

  return roleHasPermission(role, permission);
}

/**
 * Kiểm tra user có permission trong scope không.
 *
 * @param {object|null} user
 * @param {string} permission
 * @param {object} scope - { venueId?, clubId?, playerId? }
 * @param {object} options - { rbacEnabled? }
 */
export function can(user, permission, scope = {}, options = {}) {
  const { rbacEnabled = false } = options;

  if (isRbacConfigurationDenied({ rbacEnabled })) {
    return false;
  }

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (!roleHasEffectivePermission(user, permission)) {
    return false;
  }

  if (requiresTenantOperationalEntitlement(permission)) {
    const tenantId = scope.tenantId || scope.tenant_id || null;
    const tenantDecision = decideTenantAccess(user, tenantId, { requireTarget: true });
    if (!tenantDecision.allowed) {
      return false;
    }
  }

  return matchesScope(user, permission, scope);
}

export function canAll(user, permissions = [], scope = {}, options = {}) {
  return permissions.every((permission) => can(user, permission, scope, options));
}

export function canAny(user, permissions = [], scope = {}, options = {}) {
  return permissions.some((permission) => can(user, permission, scope, options));
}

export function assertCan(user, permission, scope = {}, options = {}) {
  if (
    isPlatformScopedRole(user?.role) &&
    isSystemTechnicianBusinessCapability(permission) &&
    !hasExplicitOperationalTarget(scope)
  ) {
    return {
      ok: false,
      error: `Không có quyền: ${permission} (role: SYSTEM_TECHNICIAN) — cần mục tiêu tài nguyên.`,
      code: "TARGET_REQUIRED",
      permission,
    };
  }

  if (!can(user, permission, scope, options)) {
    const role = normalizeRole(user?.role) || user?.role || "anonymous";
    const tenantId = scope.tenantId || scope.tenant_id || null;
    if (requiresTenantOperationalEntitlement(permission)) {
      const tenantDecision = decideTenantAccess(user, tenantId, { requireTarget: true });
      if (!tenantDecision.allowed) {
        return {
          ok: false,
          error: tenantDecision.reason || `Không có quyền: ${permission}`,
          code: tenantDecision.code || "FORBIDDEN",
          permission,
        };
      }
    }
    return {
      ok: false,
      error: `Không có quyền: ${permission} (role: ${role})`,
      code: "FORBIDDEN",
      permission,
    };
  }

  return { ok: true };
}

export function canAccessVenue(user, venueId, options = {}) {
  const { rbacEnabled = false } = options;

  if (isRbacConfigurationDenied({ rbacEnabled })) {
    return false;
  }

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (!venueId) {
    return false;
  }

  if (hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
  }

  if (isPlatformScopedRole(user.role)) {
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    return Boolean(user.venueId) && user.venueId === venueId;
  }

  if (isClubScopedRole(user.role)) {
    return Boolean(user.venueId) && user.venueId === venueId;
  }

  return false;
}

export function canAccessClub(user, clubId, clubMeta = {}, options = {}) {
  const { rbacEnabled = false } = options;
  const { venueId: clubVenueId = null } = clubMeta;

  if (isRbacConfigurationDenied({ rbacEnabled })) {
    return false;
  }

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN)) {
    return Boolean(clubId);
  }

  if (isPlatformScopedRole(user.role)) {
    return false;
  }

  if (!clubId) {
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    if (!user.venueId) {
      return false;
    }

    const { meta, cloudAuthoritative, ready } = getClubMetaForAuthz(clubId, {
      user,
      tenantId: user.tenantId || null,
      rbacEnabled,
    });

    // Canonical deny-by-default: when the cloud registry is authoritative but the
    // scope is not resolved (loading / error), never grant from stale/local data.
    if (cloudAuthoritative && !ready) {
      return false;
    }

    // Cloud authoritative + resolved: the club must be present in the canonical
    // scope. Do not trust a caller-supplied venueId for an out-of-scope club.
    const registryVenueId = meta?.venueId ?? (cloudAuthoritative ? null : clubVenueId) ?? null;

    if (registryVenueId === user.venueId) {
      return true;
    }

    const explicitTenant = meta?.tenantId ?? null;
    if (explicitTenant && user.tenantId && explicitTenant === user.tenantId && registryVenueId === user.venueId) {
      return true;
    }

    return false;
  }

  if (isClubScopedRole(user.role)) {
    const membership = decideClubMembershipAccess(user, clubId);
    if (!membership.allowed) {
      return false;
    }
    if (clubVenueId && user.venueId && user.venueId !== clubVenueId) {
      return false;
    }
    return true;
  }

  if (isRefereeRole(user.role)) {
    if (!user.venueId) {
      return false;
    }
    if (clubVenueId && user.venueId !== clubVenueId) {
      return false;
    }
    const { meta, cloudAuthoritative, ready } = getClubMetaForAuthz(clubId, {
      user,
      tenantId: user.tenantId || null,
      rbacEnabled,
    });
    if (cloudAuthoritative && !ready) {
      return false;
    }
    const registryVenueId = meta?.venueId ?? clubVenueId ?? null;
    if (registryVenueId && registryVenueId !== user.venueId) {
      return false;
    }
    return !registryVenueId || registryVenueId === user.venueId;
  }

  return false;
}

export function canAccessCluster(user, clusterId, clusterMeta = {}, options = {}) {
  const { rbacEnabled = false } = options;
  const { venueId: clusterVenueId = null } = clusterMeta;

  if (isRbacConfigurationDenied({ rbacEnabled })) {
    return false;
  }

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (!clusterId) {
    return false;
  }

  if (hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
  }

  if (isPlatformScopedRole(user.role)) {
    return false;
  }

  if (!isCourtClustersEnabled()) {
    if (clusterVenueId && user?.venueId) {
      return user.venueId === clusterVenueId;
    }
    if (user?.venueId && cluster.venueId) {
      return user.venueId === cluster.venueId;
    }
    return isVenueScopedRole(user?.role);
  }

  return canUserAccessCluster(user, clusterId, { venueId: clusterVenueId || user?.venueId });
}

function isViewLikePermission(permission) {
  const action = String(permission || "").split(".").pop();
  return (
    action === "view" ||
    action === "read" ||
    action === "view_summary" ||
    action === "view_private" ||
    String(action).startsWith("view_")
  );
}

function hasExplicitOperationalTarget(scope = {}) {
  return Boolean(
    scope.tenantId ||
      scope.tenant_id ||
      scope.venueId ||
      scope.clubId ||
      scope.clusterId ||
      scope.cluster_id ||
      scope.resourceId ||
      scope.tournamentId ||
      scope.tournament_id ||
      scope.teamId ||
      scope.team_id
  );
}

function matchesSuperAdminScope(permission, scope = {}) {
  if (isViewLikePermission(permission)) {
    return true;
  }
  const scopes = getPermissionScopes(permission);
  if (
    scopes.includes(PERMISSION_SCOPE.GLOBAL) ||
    scopes.includes(PERMISSION_SCOPE.PLATFORM)
  ) {
    return true;
  }
  if (
    permission === PERMISSIONS.USER_MANAGE ||
    permission === PERMISSIONS.ROLE_MANAGE ||
    permission === PERMISSIONS.SETTINGS_VIEW ||
    permission === PERMISSIONS.SYSTEM_SETTING
  ) {
    return true;
  }
  return hasExplicitOperationalTarget(scope);
}

function matchesScope(user, permission, scope) {
  if (hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN)) {
    return matchesSuperAdminScope(permission, scope);
  }

  const scopes = getPermissionScopes(permission);

  if (hasRole(user, ROLES.PLAYER) && scopes.includes(PERMISSION_SCOPE.SELF)) {
    return matchesSelfScope(user, scope, permission);
  }

  if (isTournamentTeamScopedRole(user.role) && scopes.includes(PERMISSION_SCOPE.TEAM)) {
    return matchesTeamScope(user, scope);
  }

  return scopes.some((permissionScope) =>
    matchesScopeType(user, permissionScope, scope, permission)
  );
}

function matchesScopeType(user, permissionScope, scope, permission) {
  switch (permissionScope) {
    case PERMISSION_SCOPE.GLOBAL:
      return isGlobalRole(user.role);

    case PERMISSION_SCOPE.PLATFORM:
      return matchesPlatformScope(user, scope, permission);

    case PERMISSION_SCOPE.TENANT:
      return matchesTenantScope(user, scope);

    case PERMISSION_SCOPE.VENUE:
      return matchesVenueScope(user, scope.venueId, permission);

    case PERMISSION_SCOPE.CLUSTER:
      return matchesClusterScope(user, scope);

    case PERMISSION_SCOPE.CLUB:
      return matchesClubScope(user, scope);

    case PERMISSION_SCOPE.TOURNAMENT:
      return matchesTournamentScope(user, scope, permission);

    case PERMISSION_SCOPE.TEAM:
      return matchesTeamScope(user, scope);

    case PERMISSION_SCOPE.SELF:
      return matchesSelfScope(user, scope, permission);

    default:
      return false;
  }
}

function matchesPlatformScope(user, scope, permission) {
  if (!isPlatformScopedRole(user.role)) {
    return false;
  }

  const classified = classifySystemTechnicianPermission(permission);
  if (!classified || classified.businessOrTechnical === "BUSINESS") {
    return false;
  }

  if (classified.explicitTargetRequired && !hasExplicitOperationalTarget(scope)) {
    return false;
  }

  if (scope.tenantId || scope.venueId || scope.clubId) {
    return classified.actionClass !== "BUSINESS_MUTATION" && classified.businessOrTechnical === "TECHNICAL";
  }

  return classified.businessOrTechnical === "TECHNICAL";
}

function matchesTournamentScope(user, scope, permission) {
  const tournamentId = scope.tournamentId || scope.tournament_id;
  if (!tournamentId) {
    if (isViewLikePermission(permission) && isVenueScopedRole(user.role) && user.venueId) {
      return !scope.venueId || scope.venueId === user.venueId;
    }
    if (isViewLikePermission(permission) && isClubScopedRole(user.role)) {
      return collectActiveClubEntitlements(user).entitlements.length > 0;
    }
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    if (scope.venueId && user.venueId && user.venueId !== scope.venueId) {
      return false;
    }
    return Boolean(user.venueId);
  }

  if (isClubScopedRole(user.role)) {
    if (scope.clubId) {
      return decideClubMembershipAccess(user, scope.clubId).allowed;
    }
    return collectActiveClubEntitlements(user).entitlements.length > 0;
  }

  if (isTournamentTeamScopedRole(user.role)) {
    const userTournamentId = user.tournamentId || user.tournament_id;
    return Boolean(userTournamentId && userTournamentId === tournamentId);
  }

  return false;
}

function matchesTeamScope(user, scope) {
  const tournamentId = scope.tournamentId || scope.tournament_id;
  const teamId = scope.teamId || scope.team_id;

  if (!isTournamentTeamScopedRole(user.role)) {
    return false;
  }

  const userTournamentId = user.tournamentId || user.tournament_id;
  const userTeamId = user.teamId || user.team_id;

  if (!userTournamentId || !userTeamId) {
    return false;
  }

  if (!tournamentId || !teamId) {
    return false;
  }

  return userTournamentId === tournamentId && userTeamId === teamId;
}

function matchesClusterScope(user, scope) {
  const clusterId = scope.clusterId || scope.cluster_id;
  const venueId = scope.venueId || scope.tenantId || user.venueId;

  if (!isCourtClustersEnabled()) {
    return matchesVenueScope(user, venueId);
  }

  if (!clusterId) {
    if (isOrgWideClusterRole(user) || isGlobalRole(user.role)) {
      return matchesVenueScope(user, venueId);
    }

    return resolveAssignedClusterIdsForUser(user).length > 0;
  }

  if (venueId && user.venueId && user.venueId !== venueId) {
    return false;
  }

  if (isGlobalRole(user.role) || isOrgWideClusterRole(user)) {
    return !venueId || !user.venueId || user.venueId === venueId;
  }

  return canUserAccessCluster(user, clusterId, { venueId });
}

function matchesTenantScope(user, scope) {
  const tenantId = scope.tenantId || scope.tenant_id || null;
  if (!tenantId) {
    return false;
  }
  if (decideTenantAccess(user, tenantId, { requireTarget: true }).allowed) {
    return true;
  }
  // Explicit tenant target for holders of tenant-scoped Club permissions
  // (e.g. PLAYER / CLUB_MANAGER club.create) without stuffing Tenant into venueId.
  return Boolean(user.tenantId) && user.tenantId === tenantId;
}

function matchesVenueScope(user, venueId, permission) {
  if (permission === PERMISSIONS.SYSTEM_SETTING && !venueId) {
    return false;
  }

  if (!venueId) {
    return (
      (isVenueScopedRole(user.role) && Boolean(user.venueId)) ||
      isPlatformScopedRole(user.role)
    );
  }

  if (isPlatformScopedRole(user.role)) {
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    return Boolean(user.venueId) && user.venueId === venueId;
  }

  if (isClubScopedRole(user.role)) {
    return Boolean(user.venueId) && user.venueId === venueId;
  }

  return false;
}

function matchesClubScope(user, scope) {
  const { clubId, venueId } = scope;

  if (isPlatformScopedRole(user.role)) {
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    if (!user.venueId) {
      return false;
    }
    if (venueId && user.venueId !== venueId) {
      return false;
    }
    if (clubId) {
      return canAccessClub(user, clubId, { venueId }, { rbacEnabled: true });
    }
    return !venueId || user.venueId === venueId;
  }

  if (isRefereeRole(user.role)) {
    if (!user.venueId) {
      return false;
    }
    if (venueId && user.venueId !== venueId) {
      return false;
    }
    return true;
  }

  if (isClubScopedRole(user.role)) {
    if (clubId) {
      return decideClubMembershipAccess(user, clubId).allowed;
    }
    if (venueId && user.venueId && user.venueId !== venueId) {
      return false;
    }
    return collectActiveClubEntitlements(user).entitlements.length > 0;
  }

  return false;
}

function matchesSelfScope(user, scope, permission) {
  if (!hasRole(user, ROLES.PLAYER)) {
    return false;
  }

  if (scope.clubId && user.clubId && user.clubId !== scope.clubId) {
    return false;
  }

  if (permission === PERMISSIONS.PLAYER_VIEW || permission === PERMISSIONS.PLAYER_UPDATE) {
    if (!scope.playerId) {
      return false;
    }
    return user.playerId === scope.playerId;
  }

  if (
    permission === PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE ||
    permission === PERMISSIONS.SKILL_LEVEL_REQUEST_CHANGE
  ) {
    if (!scope.playerId) {
      return false;
    }
    return user.playerId === scope.playerId;
  }

  if (permission === PERMISSIONS.TOURNAMENT_VIEW || permission === PERMISSIONS.STATISTICS_VIEW) {
    return true;
  }

  return Boolean(user.playerId || user.clubId);
}

/**
 * Kiểm tra viewer có được xem điểm trình độ riêng tư của VĐV không.
 */
export function canViewPlayerSkillLevel(user, scope = {}, options = {}) {
  const { clubId, playerId, tournamentContext = false } = scope;

  if (isRbacConfigurationDenied({ rbacEnabled: options.rbacEnabled })) {
    return false;
  }

  if (!isRbacEnforced({ rbacEnabled: options.rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (playerId && user.playerId && user.playerId === playerId) {
    return can(
      user,
      PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE,
      { clubId, playerId },
      options
    );
  }

  if (
    can(user, PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE, { clubId, playerId }, options)
  ) {
    return true;
  }

  if (
    tournamentContext &&
    can(
      user,
      PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE,
      { clubId, tournamentId: scope.tournamentId },
      options
    )
  ) {
    return true;
  }

  return false;
}
