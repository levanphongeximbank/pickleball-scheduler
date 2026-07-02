import { ROLES, rolesEqual, normalizeRole } from "./roles.js";
import { PERMISSIONS } from "./permissions.js";
import {
  isApiEnabled,
  isMarketplaceEnabled,
} from "../features/integrations/config/integrationFlags.js";

const FEATURE_FLAG_CHECKERS = Object.freeze({
  marketplace: isMarketplaceEnabled,
  api: isApiEnabled,
  integrations: () => isApiEnabled() || isMarketplaceEnabled(),
});

/**
 * Permission tối thiểu cho mỗi route — có thể nhiều lựa chọn (OR).
 */
export const ROUTE_ACCESS_PERMISSIONS = Object.freeze({
  "/": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.FINANCE_VIEW, PERMISSIONS.BOOKING_VIEW],
  "/dashboard": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.FINANCE_VIEW, PERMISSIONS.BOOKING_VIEW],
  "/players": [PERMISSIONS.PLAYER_VIEW],
  "/court-management": [PERMISSIONS.COURT_VIEW],
  "/court-management/calendar": [PERMISSIONS.BOOKING_VIEW],
  "/court-management/bookings": [PERMISSIONS.BOOKING_VIEW],
  "/court-management/revenue": [PERMISSIONS.FINANCE_VIEW],
  "/court-management/customers": [PERMISSIONS.CUSTOMER_VIEW],
  "/court-management/courts": [PERMISSIONS.COURT_VIEW],
  "/select-players": [PERMISSIONS.SCHEDULING_VIEW],
  "/daily-play": [PERMISSIONS.TOURNAMENT_VIEW],
  "/club": [PERMISSIONS.CLUB_VIEW],
  "/clubs": [PERMISSIONS.CLUB_VIEW],
  "/tournament": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/bracket": [PERMISSIONS.TOURNAMENT_VIEW],
  "/court-engine": [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.SCHEDULING_RUN],
  "/statistics": [PERMISSIONS.STATISTICS_VIEW],
  "/court-management/future": [
    PERMISSIONS.COURT_UPDATE,
    PERMISSIONS.VENUE_UPDATE,
    PERMISSIONS.COURT_VIEW,
  ],
  "/settings": [PERMISSIONS.SETTINGS_VIEW],
  "/settings/integrations": [PERMISSIONS.INTEGRATION_VIEW, PERMISSIONS.SETTINGS_VIEW],
  "/settings/integrations/payments": [PERMISSIONS.INTEGRATION_MANAGE],
  "/settings/integrations/zalo-oa": [PERMISSIONS.INTEGRATION_MANAGE],
  "/billing": [PERMISSIONS.BILLING_VIEW],
  "/billing/current-plan": [PERMISSIONS.BILLING_VIEW],
  "/billing/usage": [PERMISSIONS.BILLING_VIEW],
  "/billing/invoices": [PERMISSIONS.BILLING_INVOICE_VIEW],
  "/billing/payment": [PERMISSIONS.BILLING_PAYMENT_VIEW],
  "/billing/upgrade": [PERMISSIONS.BILLING_SUBSCRIPTION_VIEW],
  "/billing/support": [PERMISSIONS.BILLING_VIEW],
  "/admin/billing": [PERMISSIONS.BILLING_MANAGE],
  "/admin/billing/tenants": [PERMISSIONS.BILLING_MANAGE],
  "/admin/billing/plans": [PERMISSIONS.BILLING_PLAN_VIEW],
  "/admin/billing/invoices": [PERMISSIONS.BILLING_INVOICE_VIEW],
  "/admin/billing/payments": [PERMISSIONS.BILLING_PAYMENT_VIEW],
  "/admin/billing/audit": [PERMISSIONS.BILLING_AUDIT_VIEW],
  "/users": [PERMISSIONS.USER_MANAGE],
  "/audit": [PERMISSIONS.USER_MANAGE],
  "/profile": [],
  "/referee": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE],
  "/403": [],
  "/admin/tenants": [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.VENUE_UPDATE],
  "/mobile/check-in": [PERMISSIONS.TOURNAMENT_VIEW],
  "/mobile/qr-scan": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TOURNAMENT_UPDATE],
  "/mobile/qr-generate": [PERMISSIONS.TOURNAMENT_UPDATE],
  "/mobile/notifications": [],
  "/mobile/player": [],
  "/mobile/operations": [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.COURT_VIEW,
    PERMISSIONS.FINANCE_VIEW,
  ],
});

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
