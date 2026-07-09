import { ROLES, rolesEqual, normalizeRole } from "./roles.js";
import { PERMISSIONS } from "./permissions.js";
import {
  isApiEnabled,
  isMarketplaceEnabled,
} from "../features/integrations/config/integrationFlags.js";
import {
  isNavFeatureEnabled,
  NAV_ITEM_STATUS,
  MENU_GROUP_IDS,
  resolveNavRole,
  resolveRoleMenuAccess,
  ROUTE_PERMISSIONS,
  isRouteRestrictedForUser,
} from "../config/navigationConfig.js";
import { getNavigationPermissions } from "../config/navigationPermissions.js";

const FEATURE_FLAG_CHECKERS = Object.freeze({
  marketplace: isMarketplaceEnabled,
  api: isApiEnabled,
  integrations: () => isApiEnabled() || isMarketplaceEnabled(),
  ai: isNavFeatureEnabled.bind(null, "ai"),
});

/** Route không cần permission khi RBAC bật (hồ sơ, thông báo, placeholder). */
const PUBLIC_MENU_PATHS = new Set([
  "/profile",
  "/my-club",
  "/clubs/discover",
  "/club/activity",
  "/coaching/coach-list",
  "/coaching/register",
  "/player/profile",
  "/player/skill",
  "/player/skill-assessment",
  "/mobile/notifications",
  "/403",
]);

function isPublicMenuPath(pathname) {
  if (!pathname) return false;
  const path = String(pathname).split("?")[0];
  if (PUBLIC_MENU_PATHS.has(path)) return true;
  return path.startsWith("/coming-soon");
}

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

  if (pathname.startsWith("/team-portal/")) {
    return [PERMISSIONS.TEAM_VIEW, PERMISSIONS.TEAM_MEMBER_VIEW];
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

  if (pathname.startsWith("/finance/")) {
    return [PERMISSIONS.FINANCE_VIEW];
  }

  if (pathname.startsWith("/crm/reminders/booking")) {
    return [PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW];
  }

  if (pathname.startsWith("/crm/messages")) {
    return [PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW];
  }

  if (pathname.startsWith("/crm/")) {
    return [PERMISSIONS.CUSTOMER_VIEW];
  }

  if (pathname.startsWith("/court-management/customers")) {
    return [PERMISSIONS.CUSTOMER_VIEW];
  }

  if (pathname.startsWith("/court-management/members")) {
    return [PERMISSIONS.CUSTOMER_VIEW];
  }

  if (pathname.startsWith("/court-management/")) {
    return [PERMISSIONS.COURT_VIEW, PERMISSIONS.BOOKING_VIEW];
  }

  if (pathname.startsWith("/marketplace")) {
    return [PERMISSIONS.MARKETPLACE_VIEW];
  }

  if (pathname.startsWith("/coming-soon")) {
    return [];
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

export function canAccessRoute(can, pathname, scope = {}, user = null) {
  if (user && isRouteRestrictedForUser(user, pathname)) {
    return false;
  }

  const permissions = getRouteAccessPermissions(pathname);
  if (permissions.length === 0) return true;

  const routeScope = { ...scope };
  if (pathname === "/players") {
    delete routeScope.playerId;
  }

  return permissions.some((permission) => can(permission, routeScope));
}

export function resolveMenuItemPath(item, user) {
  if (typeof item.resolvePath === "function") {
    return item.resolvePath(user);
  }
  return item.path;
}

/**
 * Resolve permission cho menu item — item.permissions → navigationPermissions → route.
 */
export function resolveMenuItemPermissions(item, user) {
  if (item?.permissions?.length) {
    return item.permissions;
  }

  if (item?.key) {
    const keyed = getNavigationPermissions(item.key);
    if (keyed.length) {
      return keyed;
    }
  }

  const path = resolveMenuItemPath(item, user);
  if (path) {
    return getRouteAccessPermissions(String(path).split("?")[0]);
  }

  return [];
}

function passesMenuPermissionCheck(item, { can, user, scope }, { allowEmpty = false } = {}) {
  const permissions = resolveMenuItemPermissions(item, user);

  if (!permissions.length) {
    if (allowEmpty) return true;
    if (item?.roles?.length) return true;
    const path = resolveMenuItemPath(item, user);
    return isPublicMenuPath(path);
  }

  const resolvedScope = {
    ...scope,
    playerId: scope.playerId ?? user?.playerId ?? null,
    tournamentId: scope.tournamentId ?? user?.tournamentId ?? user?.tournament_id ?? null,
    teamId: scope.teamId ?? user?.teamId ?? user?.team_id ?? null,
  };

  if (!permissions.some((permission) => can(permission, resolvedScope))) {
    return false;
  }

  const path = resolveMenuItemPath(item, user);
  if (path) {
    return canAccessRoute(can, String(path).split("?")[0], resolvedScope, user);
  }

  return true;
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

  const isFolder = Boolean(item.children?.length);
  const permissions = resolveMenuItemPermissions(item, user);
  const allowEmpty = isFolder && !permissions.length;
  return passesMenuPermissionCheck(item, { can, user, scope }, { allowEmpty });
}

function isGroupAllowedForRole(group, user, rbacEnabled) {
  if (!rbacEnabled) {
    return true;
  }

  if (group.id === MENU_GROUP_IDS.PROFILE) {
    return Boolean(user?.role);
  }

  const navRole = resolveNavRole(user?.role);
  if (!navRole) {
    return group.id === MENU_GROUP_IDS.SUPPORT;
  }

  const allowed = resolveRoleMenuAccess(navRole);
  if (allowed === "*") {
    return true;
  }

  if (!Array.isArray(allowed) || allowed.length === 0) {
    return group.id === MENU_GROUP_IDS.SUPPORT;
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

function filterNavTreeItems(items, ctx) {
  const { can, rbacEnabled, isAuthenticated, user, scope } = ctx;
  const filtered = [];

  for (const item of items || []) {
    if (item.children?.length) {
      if (
        rbacEnabled &&
        isAuthenticated &&
        !isMenuItemVisible(item, { can, rbacEnabled, isAuthenticated, user, scope })
      ) {
        continue;
      }

      const children = filterNavTreeItems(item.children, ctx);
      if (!children.length) continue;
      filtered.push({ ...item, children });
      continue;
    }

    const path = resolveMenuItemPath(item, user);
    if (!path) continue;
    if (!isMenuItemVisible(item, { can, rbacEnabled, isAuthenticated, user, scope })) {
      continue;
    }
    filtered.push(item);
  }

  return filtered;
}

function findMenuItemsByKey(items, key, bucket = []) {
  for (const item of items || []) {
    if (item.key === key) {
      bucket.push(item);
    }
    if (item.children?.length) {
      findMenuItemsByKey(item.children, key, bucket);
    }
  }
  return bucket;
}

export function filterMenuGroups(groups, authContext, scope = {}) {
  const { can, rbacEnabled, isAuthenticated, user } = authContext;

  if (rbacEnabled && !isAuthenticated) {
    return groups
      .map((group) => ({
        ...group,
        items: findMenuItemsByKey(group.items, "support-settings"),
      }))
      .filter((group) => group.items.length > 0);
  }

  const ctx = { can, rbacEnabled, isAuthenticated, user, scope };

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
      items: filterNavTreeItems(group.items, ctx),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Lọc hub điều hướng trong màn hình (tab + thẻ) theo RBAC.
 */
export function filterInPageNavHub(hub, authContext, scope = {}) {
  if (!hub?.sections?.length) {
    return hub;
  }

  const { can, rbacEnabled, isAuthenticated, user } = authContext;
  const ctx = { can, rbacEnabled, isAuthenticated, user, scope };
  const sections = [];

  for (const section of hub.sections) {
    const items = (section.items || []).filter((item) =>
      isMenuItemVisible(item, ctx)
    );
    if (!items.length) continue;
    sections.push({ ...section, items });
  }

  if (!sections.length) {
    return null;
  }

  return { ...hub, sections };
}

export function getDefaultHomePath(user, rbacEnabled = false) {
  if (!rbacEnabled || !user?.role) {
    return "/dashboard";
  }

  switch (normalizeRole(user.role)) {
    case ROLES.PLAYER:
      // Người chơi mới đăng ký chưa gắn CLB — hướng tới chọn CLB.
      if (!user.clubId && !user.club_id) {
        return "/my-club";
      }
      return "/tournament";
    case ROLES.CLUB_MANAGER:
      return "/club";
    case ROLES.CASHIER:
      return "/court-management/bookings";
    case ROLES.ACCOUNTANT:
      return "/court-management/revenue";
    case ROLES.REFEREE:
      return "/referee";
    case ROLES.SYSTEM_TECHNICIAN:
      return "/dashboard";
    case ROLES.TEAM_CAPTAIN: {
      const tournamentId = user.tournamentId || user.tournament_id;
      return tournamentId ? `/team-portal/${tournamentId}` : "/profile";
    }
    default:
      return "/dashboard";
  }
}

/** Sau đăng nhập — không quay lại route bị cấm (vd. PLAYER chưa CLB → /tournament). */
export function resolvePostAuthRedirectPath(requestedPath, user, rbacEnabled = false) {
  const homePath = getDefaultHomePath(user, rbacEnabled);
  const path = String(requestedPath || "").split("?")[0];

  if (!path || path === "/login" || path === "/403") {
    return homePath;
  }

  if (path === "/" && homePath !== "/") {
    return homePath;
  }

  if (path === "/home") {
    return path;
  }

  if (rbacEnabled && normalizeRole(user?.role) === ROLES.PLAYER) {
    if (!user?.clubId && !user?.club_id) {
      if (
        path === "/tournament" ||
        path.startsWith("/tournament/") ||
        path === "/dashboard" ||
        path === "/"
      ) {
        return "/my-club";
      }
    }
  }

  return path;
}

export { resolveRouteAccessScope } from "../features/tenant/services/profileVenueService.js";
