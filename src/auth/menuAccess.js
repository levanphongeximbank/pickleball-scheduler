import { ROLES, rolesEqual, normalizeRole } from "./roles.js";
import { PERMISSIONS } from "./permissions.js";
import {
  isApiEnabled,
  isMarketplaceEnabled,
} from "../features/integrations/config/integrationFlags.js";
import {
  isNavFeatureEnabled,
  NAV_ITEM_STATUS,
  resolveRoleMenuAccess,
  ROUTE_PERMISSIONS,
} from "../config/navigationConfig.js";

const FEATURE_FLAG_CHECKERS = Object.freeze({
  marketplace: isMarketplaceEnabled,
  api: isApiEnabled,
  integrations: () => isApiEnabled() || isMarketplaceEnabled(),
  ai: isNavFeatureEnabled.bind(null, "ai"),
});

/** Permission tối thiểu cho mỗi route — derive từ navigationConfig. */
export const ROUTE_ACCESS_PERMISSIONS = ROUTE_PERMISSIONS;

export function getRouteAccessPermissions(pathname) {
  if (!pathname) return [];

  const exact = ROUTE_ACCESS_PERMISSIONS[pathname];
  if (exact) return exact;

  if (pathname.startsWith("/players/profile/")) {
    return [PERMISSIONS.PLAYER_VIEW];
  }

  if (pathname.startsWith("/clubs/")) {
    return [PERMISSIONS.CLUB_VIEW];
  }

  if (pathname.startsWith("/court-engine")) {
    return [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.SCHEDULING_RUN];
  }

  if (pathname.startsWith("/tournament/director/")) {
    return [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.TOURNAMENT_UPDATE];
  }

  if (pathname.startsWith("/referee/match/")) {
    return [];
  }

  if (pathname === "/referee" || pathname.startsWith("/referee/")) {
    return [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE];
  }

  if (pathname.startsWith("/tournament/")) {
    return [PERMISSIONS.TOURNAMENT_VIEW];
  }

  if (pathname.startsWith("/court-management/future")) {
    return [PERMISSIONS.COURT_UPDATE, PERMISSIONS.VENUE_UPDATE, PERMISSIONS.COURT_VIEW];
  }

  if (pathname.startsWith("/court-management/revenue")) {
    return [PERMISSIONS.FINANCE_VIEW];
  }

  if (pathname.startsWith("/court-management/customers")) {
    return [PERMISSIONS.CUSTOMER_VIEW];
  }

  if (pathname.startsWith("/court-management/")) {
    return [PERMISSIONS.COURT_VIEW, PERMISSIONS.BOOKING_VIEW];
  }

  if (pathname.startsWith("/marketplace")) {
    return [PERMISSIONS.MARKETPLACE_VIEW];
  }

  if (pathname.startsWith("/mobile/")) {
    const mobilePerms = ROUTE_ACCESS_PERMISSIONS[pathname];
    if (mobilePerms) {
      return mobilePerms;
    }
    return [];
  }

  return [];
}

export function canAccessRoute(can, pathname, scope = {}) {
  const permissions = getRouteAccessPermissions(pathname);
  if (permissions.length === 0) return true;

  const routeScope = { ...scope };
  if (pathname === "/players") {
    delete routeScope.playerId;
  }

  return permissions.some((permission) => can(permission, routeScope));
}

export function isMenuItemVisible(item, { can, rbacEnabled, isAuthenticated, user, scope }) {
  if (item.navStatus === NAV_ITEM_STATUS.FUTURE) {
    return false;
  }

  if (item.requiresFeature) {
    const checker = FEATURE_FLAG_CHECKERS[item.requiresFeature];
    if (checker && !checker()) {
      return false;
    }
  }

  if (!rbacEnabled || !isAuthenticated) {
    return true;
  }

  if (item.roles?.length && user?.role) {
    const allowed = item.roles.some((role) => rolesEqual(user.role, role));
    if (!allowed) return false;
  }

  if (item.excludeRoles?.length && user?.role) {
    const excluded = item.excludeRoles.some((role) => rolesEqual(user.role, role));
    if (excluded) return false;
  }

  if (!item.permissions?.length) {
    return true;
  }

  const resolvedScope = {
    ...scope,
    playerId: scope.playerId ?? user?.playerId ?? null,
  };

  return item.permissions.some((permission) => can(permission, resolvedScope));
}


export function resolveMenuItemPath(item, user) {
  if (typeof item.resolvePath === "function") {
    return item.resolvePath(user);
  }
  return item.path;
}

function isGroupAllowedForRole(group, user, rbacEnabled) {
  if (!rbacEnabled || !user?.role) {
    return true;
  }

  const allowed = resolveRoleMenuAccess(user.role);
  if (allowed === "*") {
    return true;
  }

  if (group.id && !allowed.includes(group.id)) {
    return false;
  }

  return true;
}

function isGroupFeatureVisible(group) {
  if (!group.requiresFeature) {
    return true;
  }
  const checker = FEATURE_FLAG_CHECKERS[group.requiresFeature];
  return !checker || checker();
}

export function filterMenuGroups(groups, authContext, scope = {}) {
  const { can, rbacEnabled, isAuthenticated, user } = authContext;

  if (rbacEnabled && !isAuthenticated) {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.key === "support-settings"),
      }))
      .filter((group) => group.items.length > 0);
  }

  return groups
    .filter((group) => isGroupFeatureVisible(group))
    .filter((group) => isGroupAllowedForRole(group, user, rbacEnabled))
    .filter((group) => {
      if (!group.roles?.length) return true;
      if (!rbacEnabled || !isAuthenticated) return true;
      return user?.role && group.roles.some((role) => rolesEqual(user.role, role));
    })
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const path = resolveMenuItemPath(item, user);
        if (!path) return false;
        return isMenuItemVisible(item, { can, rbacEnabled, isAuthenticated, user, scope });
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function getDefaultHomePath(user, rbacEnabled = false) {
  if (!rbacEnabled || !user?.role) {
    return "/";
  }

  switch (normalizeRole(user.role)) {
    case ROLES.PLAYER:
      return "/tournament";
    case ROLES.CASHIER:
      return "/court-management/bookings";
    case ROLES.ACCOUNTANT:
      return "/court-management/revenue";
    case ROLES.REFEREE:
      return "/referee";
    default:
      return "/";
  }
}

export { resolveRouteAccessScope } from "../features/tenant/services/profileVenueService.js";
