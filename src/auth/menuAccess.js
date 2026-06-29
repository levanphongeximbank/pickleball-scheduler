import { ROLES } from "./roles.js";
import { PERMISSIONS } from "./permissions.js";

/**
 * Permission tối thiểu cho mỗi route — có thể nhiều lựa chọn (OR).
 */
export const ROUTE_ACCESS_PERMISSIONS = Object.freeze({
  "/": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW],
  "/players": [PERMISSIONS.PLAYERS_VIEW],
  "/court-management": [PERMISSIONS.COURTS_VIEW],
  "/court-management/calendar": [PERMISSIONS.BOOKINGS_VIEW],
  "/court-management/bookings": [PERMISSIONS.BOOKINGS_VIEW],
  "/court-management/revenue": [PERMISSIONS.REVENUE_VIEW, PERMISSIONS.ACCOUNTING_VIEW],
  "/court-management/customers": [PERMISSIONS.CUSTOMERS_VIEW],
  "/court-management/courts": [PERMISSIONS.COURTS_VIEW],
  "/select-players": [PERMISSIONS.SCHEDULING_VIEW],
  "/club": [PERMISSIONS.CLUB_VIEW],
  "/tournament": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW],
  "/tournament/bracket": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW],
  "/statistics": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.PLAYER_RESULTS_VIEW],
  "/court-management/future": [
    PERMISSIONS.COURTS_MANAGE,
    PERMISSIONS.VENUE_MANAGE,
    PERMISSIONS.COURTS_VIEW,
  ],
  "/settings": [PERMISSIONS.SETTINGS_VIEW],
});

export function getRouteAccessPermissions(pathname) {
  if (!pathname) return [];

  const exact = ROUTE_ACCESS_PERMISSIONS[pathname];
  if (exact) return exact;

  if (pathname.startsWith("/players/profile/")) {
    return [PERMISSIONS.PLAYER_PROFILE_VIEW, PERMISSIONS.PLAYERS_VIEW];
  }

  if (pathname.startsWith("/tournament/director/")) {
    return [PERMISSIONS.TOURNAMENT_DIRECTOR, PERMISSIONS.TOURNAMENT_MANAGE];
  }

  if (pathname.startsWith("/tournament/")) {
    return [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW];
  }

  if (pathname.startsWith("/court-management/future")) {
    return [PERMISSIONS.COURTS_MANAGE, PERMISSIONS.VENUE_MANAGE, PERMISSIONS.COURTS_VIEW];
  }

  if (pathname.startsWith("/court-management/revenue")) {
    return [PERMISSIONS.REVENUE_VIEW, PERMISSIONS.ACCOUNTING_VIEW];
  }

  if (pathname.startsWith("/court-management/customers")) {
    return [PERMISSIONS.CUSTOMERS_VIEW];
  }

  if (pathname.startsWith("/court-management/")) {
    return [PERMISSIONS.COURTS_VIEW, PERMISSIONS.BOOKINGS_VIEW];
  }

  return [];
}

export function canAccessRoute(can, pathname, scope = {}) {
  const permissions = getRouteAccessPermissions(pathname);
  if (permissions.length === 0) return true;
  return permissions.some((permission) => can(permission, scope));
}

export function isMenuItemVisible(item, { can, rbacEnabled, isAuthenticated, user, scope }) {
  if (!rbacEnabled || !isAuthenticated) {
    return true;
  }

  if (item.roles?.length && user?.role && !item.roles.includes(user.role)) {
    return false;
  }

  if (!item.permissions?.length) {
    return true;
  }

  return item.permissions.some((permission) => can(permission, scope));
}

export function resolveMenuItemPath(item, user) {
  if (typeof item.resolvePath === "function") {
    return item.resolvePath(user);
  }
  return item.path;
}

export function filterMenuGroups(groups, authContext, scope = {}) {
  const { can, rbacEnabled, isAuthenticated, user } = authContext;

  if (rbacEnabled && !isAuthenticated) {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.path === "/settings"),
      }))
      .filter((group) => group.items.length > 0);
  }

  return groups
    .filter((group) => {
      if (!group.roles?.length) return true;
      if (!rbacEnabled || !isAuthenticated) return true;
      return user?.role && group.roles.includes(user.role);
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

  switch (user.role) {
    case ROLES.PLAYER:
      return "/tournament";
    case ROLES.CASHIER:
      return "/court-management/bookings";
    case ROLES.ACCOUNTANT:
      return "/court-management/revenue";
    default:
      return "/";
  }
}
