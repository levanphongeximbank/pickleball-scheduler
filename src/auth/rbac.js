import {
  ROLES,
  isGlobalRole,
  isPlatformWideRole,
  isClubScopedRole,
  isVenueScopedRole,
  isRefereeRole,
  isPlatformScopedRole,
  isTournamentTeamScopedRole,
  rolesEqual,
  normalizeRole,
} from "./roles.js";
import { getPermissionScopes, PERMISSION_SCOPE, PERMISSIONS } from "./permissions.js";
import { roleHasPermission } from "./rolePermissions.js";
import { getEffectivePermissionsForTenantRole } from "../features/identity/services/tenantRolePermissionService.js";
import { resolveGovernanceElevatedRole } from "../features/club/services/governanceRoleElevation.js";
import { isUserActive } from "../models/user.js";
import { loadClubs } from "../data/club.js";
import { getExplicitTenantIdForClub } from "../features/tenant/guards/tenantGuard.js";
import {
  canUserAccessCluster,
  isOrgWideClusterRole,
  resolveAssignedClusterIdsForUser,
} from "../features/court-cluster/services/courtClusterService.js";
import { isCourtClustersEnabled } from "../features/court-cluster/config/clusterFlags.js";

/**
 * RBAC có được áp dụng không.
 * Khi false hoặc chưa đăng nhập → mọi kiểm tra trả về true (không phá app hiện tại).
 */
export function isRbacEnforced({ rbacEnabled = false, user = null } = {}) {
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

  const tenantId = user?.tenantId || user?.venueId || null;
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

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (!roleHasEffectivePermission(user, permission)) {
    return false;
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
  if (!can(user, permission, scope, options)) {
    const role = normalizeRole(user?.role) || user?.role || "anonymous";
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

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
  }

  if (!venueId) {
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    return user.venueId === venueId;
  }

  if (isClubScopedRole(user.role)) {
    return !user.venueId || user.venueId === venueId;
  }

  return false;
}

export function canAccessClub(user, clubId, clubMeta = {}, options = {}) {
  const { rbacEnabled = false } = options;
  const { venueId: clubVenueId = null } = clubMeta;

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (isPlatformWideRole(user.role)) {
    return true;
  }

  if (!clubId) {
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    if (!user.venueId) {
      return false;
    }

    const club = loadClubs().find((item) => item.id === clubId);
    const registryVenueId = club?.venueId || clubVenueId || null;

    if (registryVenueId === user.venueId) {
      return true;
    }

    const explicitTenant = getExplicitTenantIdForClub(clubId);
    if (explicitTenant === user.venueId) {
      return true;
    }

    if (!registryVenueId && !explicitTenant) {
      return true;
    }

    return false;
  }

  if (isClubScopedRole(user.role)) {
    if (user.clubId !== clubId) {
      return false;
    }
    if (clubVenueId && user.venueId && user.venueId !== clubVenueId) {
      return false;
    }
    return true;
  }

  if (isRefereeRole(user.role)) {
    if (clubVenueId && user.venueId && user.venueId !== clubVenueId) {
      return false;
    }
    return Boolean(user.venueId);
  }

  return false;
}

export function canAccessCluster(user, clusterId, clusterMeta = {}, options = {}) {
  const { rbacEnabled = false } = options;
  const { venueId: clusterVenueId = null } = clusterMeta;

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return true;
  }

  if (!isUserActive(user)) {
    return false;
  }

  if (hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
  }

  if (!clusterId) {
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

function matchesScope(user, permission, scope) {
  if (hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
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
      return matchesPlatformScope(user, scope);

    case PERMISSION_SCOPE.VENUE:
      return matchesVenueScope(user, scope.venueId, permission);

    case PERMISSION_SCOPE.CLUSTER:
      return matchesClusterScope(user, scope);

    case PERMISSION_SCOPE.CLUB:
      return matchesClubScope(user, scope);

    case PERMISSION_SCOPE.TOURNAMENT:
      return matchesTournamentScope(user, scope);

    case PERMISSION_SCOPE.TEAM:
      return matchesTeamScope(user, scope);

    case PERMISSION_SCOPE.SELF:
      return matchesSelfScope(user, scope, permission);

    default:
      return false;
  }
}

function matchesPlatformScope(user, scope) {
  if (!isPlatformScopedRole(user.role)) {
    return false;
  }

  if (scope.tenantId && user.tenantId && user.tenantId !== scope.tenantId) {
    return false;
  }

  return true;
}

function matchesTournamentScope(user, scope) {
  const tournamentId = scope.tournamentId || scope.tournament_id;
  if (!tournamentId) {
    return isVenueScopedRole(user.role) || isClubScopedRole(user.role);
  }

  if (isVenueScopedRole(user.role)) {
    if (scope.venueId && user.venueId && user.venueId !== scope.venueId) {
      return false;
    }
    return true;
  }

  if (isClubScopedRole(user.role)) {
    if (scope.clubId && user.clubId && user.clubId !== scope.clubId) {
      return false;
    }
    return true;
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
    return true;
  }

  if (isVenueScopedRole(user.role)) {
    return user.venueId === venueId;
  }

  if (isClubScopedRole(user.role)) {
    return !user.venueId || user.venueId === venueId;
  }

  return false;
}

function matchesClubScope(user, scope) {
  const { clubId, venueId } = scope;

  if (isVenueScopedRole(user.role)) {
    if (venueId && user.venueId !== venueId) {
      return false;
    }
    return !venueId || user.venueId === venueId;
  }

  if (isRefereeRole(user.role)) {
    if (venueId && user.venueId !== venueId) {
      return false;
    }
    return Boolean(user.venueId);
  }

  if (isClubScopedRole(user.role)) {
    if (!user.clubId) {
      return false;
    }
    if (clubId && user.clubId !== clubId) {
      return false;
    }
    if (venueId && user.venueId && user.venueId !== venueId) {
      return false;
    }
    return true;
  }

  return false;
}

function matchesSelfScope(user, scope, permission) {
  if (!hasRole(user, ROLES.PLAYER)) {
    return false;
  }

  if (scope.clubId && user.clubId !== scope.clubId) {
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
