import {
  ROLES,
  isGlobalRole,
  isClubScopedRole,
  isVenueScopedRole,
  isRefereeRole,
  rolesEqual,
  normalizeRole,
} from "./roles.js";
import { getPermissionScopes, PERMISSION_SCOPE, PERMISSIONS } from "./permissions.js";
import { roleHasPermission } from "./rolePermissions.js";
import { isUserActive } from "../models/user.js";

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

  if (!roleHasPermission(user.role, permission)) {
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

  if (hasRole(user, ROLES.SUPER_ADMIN)) {
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

  if (hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
  }

  if (!clubId) {
    return false;
  }

  if (isVenueScopedRole(user.role)) {
    if (clubVenueId && user.venueId !== clubVenueId) {
      return false;
    }
    return !clubVenueId || user.venueId === clubVenueId;
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

function matchesScope(user, permission, scope) {
  if (hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
  }

  const scopes = getPermissionScopes(permission);

  if (hasRole(user, ROLES.PLAYER) && scopes.includes(PERMISSION_SCOPE.SELF)) {
    return matchesSelfScope(user, scope, permission);
  }

  return scopes.some((permissionScope) =>
    matchesScopeType(user, permissionScope, scope, permission)
  );
}

function matchesScopeType(user, permissionScope, scope, permission) {
  switch (permissionScope) {
    case PERMISSION_SCOPE.GLOBAL:
      return isGlobalRole(user.role);

    case PERMISSION_SCOPE.VENUE:
      return matchesVenueScope(user, scope.venueId, permission);

    case PERMISSION_SCOPE.CLUB:
      return matchesClubScope(user, scope);

    case PERMISSION_SCOPE.SELF:
      return matchesSelfScope(user, scope, permission);

    default:
      return false;
  }
}

function matchesVenueScope(user, venueId, permission) {
  if (permission === PERMISSIONS.SYSTEM_SETTING && !venueId) {
    return false;
  }

  if (!venueId) {
    return isVenueScopedRole(user.role) && Boolean(user.venueId);
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
    if (clubId && user.clubId && user.clubId !== clubId) {
      return false;
    }
    if (venueId && user.venueId && user.venueId !== venueId) {
      return false;
    }
    return Boolean(user.clubId || clubId);
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
    permission === PERMISSIONS.TOURNAMENT_VIEW ||
    permission === PERMISSIONS.STATISTICS_VIEW ||
    permission === PERMISSIONS.TOURNAMENT_CREATE
  ) {
    return Boolean(user.clubId);
  }

  return Boolean(user.playerId || user.clubId);
}
