import { ROLES, normalizeRole, rolesEqual } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { canAccessRoute, isMenuItemVisible } from "../../../auth/menuAccess.js";
import {
  MOBILE_BOTTOM_NAV_PROFILES,
  MOBILE_QUICK_LINKS,
  resolveMobileNavProfile,
} from "../../../config/navigationConfig.js";
import { getNavIconComponent } from "../../../config/navIcons.js";
import { canAccessOperationsDashboard } from "./operationsDashboardService.js";

/** @deprecated Dùng navigationConfig — giữ export tương thích tests. */
export const MOBILE_BOTTOM_NAV = MOBILE_BOTTOM_NAV_PROFILES.manager.map((item) => ({
  ...item,
  icon: getNavIconComponent(item.iconKey),
}));

/** @deprecated */
export const MOBILE_REFEREE_NAV = MOBILE_BOTTOM_NAV_PROFILES.referee.map((item) => ({
  ...item,
  icon: getNavIconComponent(item.iconKey),
}));

/** Mobile route → minimum permissions (OR). Empty = authenticated only with role rules. */
export const MOBILE_ROUTE_ACCESS = Object.freeze({
  "/mobile/check-in": [PERMISSIONS.TOURNAMENT_VIEW],
  "/mobile/qr-scan": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.MATCH_UPDATE],
  "/mobile/qr-generate": [PERMISSIONS.TOURNAMENT_UPDATE],
  "/mobile/notifications": [],
  "/mobile/player": [],
  "/mobile/operations": [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.COURT_VIEW,
    PERMISSIONS.FINANCE_VIEW,
  ],
});

const PLAYER_SHELL_ROLES = new Set([
  ROLES.PLAYER,
  ROLES.CLUB_MANAGER,
  ROLES.REFEREE,
  ROLES.TENANT_OWNER,
  ROLES.VENUE_MANAGER,
  ROLES.PLATFORM_ADMIN,
  ROLES.TEAM_CAPTAIN,
  ROLES.CUSTOMER,
]);

const MOBILE_ROUTE_ROLE_RULES = Object.freeze({
  "/mobile/check-in": { excludeRoles: [ROLES.PLAYER] },
  "/mobile/qr-scan": { excludeRoles: [ROLES.PLAYER] },
  "/mobile/qr-generate": { excludeRoles: [ROLES.PLAYER, ROLES.REFEREE, ROLES.CASHIER] },
  "/mobile/player": { playerShell: true },
  "/mobile/notifications": {},
  "/mobile/operations": { excludeRoles: [ROLES.PLAYER, ROLES.REFEREE] },
});

function resolveScope(auth, scope = {}) {
  const { user } = auth;
  return {
    clubId: scope.clubId ?? null,
    venueId: scope.venueId ?? user?.venueId ?? null,
    tenantId: scope.tenantId ?? user?.tenantId ?? user?.venueId ?? null,
    playerId: scope.playerId ?? user?.playerId ?? null,
    clubNav: scope.clubNav ?? null,
    membershipClubId: scope.membershipClubId ?? null,
  };
}

function resolveNavItemPath(item, user) {
  if (typeof item.resolvePath === "function") {
    return item.resolvePath(user);
  }
  return item.path;
}

function isNavItemAllowed(item, auth, scope) {
  const { can, rbacEnabled, isAuthenticated, user } = auth;
  const resolvedScope = resolveScope(auth, scope);

  if (item.action === "open-drawer") {
    return true;
  }

  if (!rbacEnabled || !isAuthenticated) {
    return true;
  }

  if (item.excludeRoles?.length && user?.role) {
    const excluded = item.excludeRoles.some((role) => rolesEqual(user.role, role));
    if (excluded) {
      return false;
    }
  }

  if (item.roles?.length && user?.role) {
    const allowed = item.roles.some((role) => rolesEqual(user.role, role));
    if (!allowed) {
      return false;
    }
  }

  if (!item.permissions?.length) {
    if (item.key === "player-home" || item.key === "player-home-main") {
      return (
        PLAYER_SHELL_ROLES.has(normalizeRole(user?.role)) ||
        Boolean(user?.playerId)
      );
    }
    return true;
  }

  return item.permissions.some((permission) => can(permission, resolvedScope));
}

function hydrateMobileNavItem(item, auth) {
  const path = resolveNavItemPath(item, auth.user);
  return {
    ...item,
    path,
    icon: getNavIconComponent(item.iconKey),
  };
}

export function filterMobileBottomNav(auth, scope = {}) {
  const { user, rbacEnabled } = auth;
  const profileKey = rbacEnabled && user?.role
    ? resolveMobileNavProfile(user.role)
    : "manager";

  const baseItems = MOBILE_BOTTOM_NAV_PROFILES[profileKey] || MOBILE_BOTTOM_NAV_PROFILES.manager;

  return baseItems
    .filter((item) => isNavItemAllowed(item, auth, scope))
    .map((item) => {
      const hydrated = hydrateMobileNavItem(item, auth);

      if (
        profileKey === "manager" &&
        item.key === "dashboard" &&
        canAccessOperationsDashboard(user, resolveScope(auth, scope))
      ) {
        return { ...hydrated, path: "/mobile/operations", label: "Vận hành" };
      }

      return hydrated;
    })
    .filter((item) => item.action || item.path);
}

export function filterMobileQuickLinks(auth, scope = {}) {
  return MOBILE_QUICK_LINKS.filter((item) => isNavItemAllowed(item, auth, scope)).map(
    (item) => hydrateMobileNavItem(item, auth)
  );
}

function passesMobileRouteRoleRules(pathname, user) {
  const rules = MOBILE_ROUTE_ROLE_RULES[pathname];
  if (!rules || !user?.role) {
    return true;
  }

  if (rules.excludeRoles?.length) {
    const excluded = rules.excludeRoles.some((role) => rolesEqual(user.role, role));
    if (excluded) {
      return false;
    }
  }

  if (rules.playerShell) {
    return (
      PLAYER_SHELL_ROLES.has(normalizeRole(user.role)) ||
      Boolean(user.playerId) ||
      normalizeRole(user.role) === ROLES.PLATFORM_ADMIN ||
      normalizeRole(user.role) === ROLES.SUPER_ADMIN
    );
  }

  return true;
}

export function canAccessMobileRoute(pathname, auth, scope = {}, options = {}) {
  const { subscriptionOk = true, isSuperAdmin = false } = options;
  const { can, rbacEnabled, isAuthenticated, user } = auth;

  if (!pathname?.startsWith("/mobile/")) {
    return canAccessRoute(can, pathname, resolveScope(auth, scope), user);
  }

  if (!rbacEnabled) {
    return true;
  }

  if (!isAuthenticated) {
    return false;
  }

  if (!subscriptionOk && !isSuperAdmin) {
    const allowedWhenExpired = new Set(["/mobile/player", "/mobile/notifications"]);
    if (!allowedWhenExpired.has(pathname)) {
      return false;
    }
  }

  if (!passesMobileRouteRoleRules(pathname, user)) {
    return false;
  }

  if (pathname === "/mobile/player") {
    return passesMobileRouteRoleRules(pathname, user);
  }

  const permissions = MOBILE_ROUTE_ACCESS[pathname];
  if (!permissions || permissions.length === 0) {
    return true;
  }

  const resolvedScope = resolveScope(auth, scope);
  return permissions.some((permission) => can(permission, resolvedScope));
}

export function getMobileRouteForbiddenMessage(pathname, options = {}) {
  const { subscriptionOk = true } = options;

  if (!subscriptionOk) {
    return "Gói thuê đã hết hạn — không thể dùng tính năng này trên mobile.";
  }

  if (pathname === "/mobile/player") {
    return "Màn hình người chơi chỉ dành cho VĐV hoặc tài khoản có hồ sơ người chơi.";
  }

  if (pathname.startsWith("/mobile/qr")) {
    return "Bạn không có quyền quét hoặc tạo mã QR check-in.";
  }

  if (pathname === "/mobile/check-in") {
    return "Bạn không có quyền xem dashboard check-in.";
  }

  if (pathname === "/mobile/operations") {
    return "Bạn không có quyền xem dashboard vận hành mobile.";
  }

  return "Bạn không có quyền truy cập màn hình mobile này.";
}

export function isMobileMenuItemVisible(item, auth, scope = {}) {
  return isMenuItemVisible(item, {
    can: auth.can,
    rbacEnabled: auth.rbacEnabled,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    scope: resolveScope(auth, scope),
  });
}
