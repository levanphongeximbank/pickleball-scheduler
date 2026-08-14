/**
 * Route guard helpers — auth production (Supabase env) tách khỏi RBAC.
 */
import { canAccessRoute } from "./menuAccess.js";
import {
  isMyTournamentsHubPath,
  isTournamentDashboardPath,
} from "./tournamentEngineRouteAccess.js";
import { isInternalRefereePortalPath } from "../features/tournament/internal/internalRefereeCanonicalPath.js";

export function isAuthRequired({ authProductionEnabled, rbacEnabled }) {
  return Boolean(authProductionEnabled || rbacEnabled);
}

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/home",
  // `/tournaments` is authenticated My Tournaments hub (not public catalog).
  // Engine routes `/tournaments/:id/*` are protected (Phase 4 OD-PLURAL-AUTHZ).
  "/clubs",
  "/courts",
  "/rankings",
  "/news",
];

/** Path được phép khi chưa đăng nhập. */
export function isPublicAuthPath(pathname, { authProductionEnabled, rbacEnabled }) {
  if (!pathname) {
    return false;
  }

  // Exact `/tournaments` hub is authenticated — never public.
  if (isMyTournamentsHubPath(pathname)) {
    return false;
  }

  if (PUBLIC_PATH_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }

  if (pathname.startsWith("/referee/") && pathname !== "/referee" && !pathname.startsWith("/referee/match/")) {
    return true;
  }

  if (rbacEnabled && !authProductionEnabled && pathname === "/settings") {
    return true;
  }

  return false;
}

/** Route chỉ cần đăng nhập, không kiểm permission RBAC. */
export function isAuthenticatedOnlyRoute(pathname) {
  if (!pathname) {
    return false;
  }

  return (
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/athletes" ||
    pathname.startsWith("/athletes/") ||
    pathname === "/player/profile" ||
    pathname.startsWith("/player/profile/") ||
    pathname === "/player/skill" ||
    pathname.startsWith("/player/skill/") ||
    pathname === "/player/skill-assessment" ||
    pathname.startsWith("/player/skill-assessment/") ||
    // /player/skill-assessment-v5 is NOT authenticated-only — pilot-aligned shadow guard (OD-B03).
    pathname === "/my-club" ||
    pathname.startsWith("/my-club/") ||
    pathname === "/discover-clubs" ||
    pathname.startsWith("/discover-clubs/") ||
    pathname === "/change-password" ||
    pathname.startsWith("/change-password/") ||
    pathname === "/referee" ||
    pathname.startsWith("/referee/match/") ||
    pathname.startsWith("/team-portal/") ||
    pathname.startsWith("/team-referee/") ||
    isInternalRefereePortalPath(pathname) ||
    // Exact `/tournaments` My Tournaments hub + `/tournaments/:id` Dashboard.
    isMyTournamentsHubPath(pathname) ||
    isTournamentDashboardPath(pathname)
  );
}

export function userMustChangePassword(user) {
  return Boolean(user?.mustChangePassword);
}

export function shouldRedirectToForcePasswordChange(pathname, user) {
  if (!userMustChangePassword(user)) {
    return pathname === "/change-password" || pathname.startsWith("/change-password/");
  }

  return pathname !== "/change-password" && !pathname.startsWith("/change-password/");
}

/** Route miễn kiểm permission (tránh loop /403). */
export function isPermissionExemptPath(pathname) {
  return pathname === "/403";
}

export function shouldRedirectToLogin(
  pathname,
  { authProductionEnabled, rbacEnabled, isAuthenticated }
) {
  if (!isAuthRequired({ authProductionEnabled, rbacEnabled })) {
    return false;
  }

  if (isAuthenticated) {
    return false;
  }

  if (isPermissionExemptPath(pathname)) {
    return true;
  }

  return !isPublicAuthPath(pathname, { authProductionEnabled, rbacEnabled });
}

/**
 * AUTH_UNKNOWN_INITIAL → full-page auth spinner.
 * AUTH_REFRESHING_KNOWN_USER → keep the protected route mounted.
 */
export function shouldRenderRouteAuthLoading({
  authLoading = false,
  isAuthenticated = false,
  pathname = "",
} = {}) {
  if (!authLoading || pathname === "/login") {
    return false;
  }
  if (isAuthenticated) {
    return false;
  }
  return true;
}

export function shouldRedirectToForbidden(
  pathname,
  { rbacEnabled, isAuthenticated, can, scope, user }
) {
  if (!rbacEnabled || !isAuthenticated) {
    return false;
  }

  if (isPermissionExemptPath(pathname)) {
    return false;
  }

  if (isAuthenticatedOnlyRoute(pathname)) {
    return false;
  }

  return !canAccessRoute(can, pathname, scope, user);
}
