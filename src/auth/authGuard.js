/**
 * Route guard helpers — auth production (Supabase env) tách khỏi RBAC.
 */
import { canAccessRoute } from "./menuAccess.js";

export function isAuthRequired({ authProductionEnabled, rbacEnabled }) {
  return Boolean(authProductionEnabled || rbacEnabled);
}

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/home",
  "/tournaments",
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
    pathname === "/player/profile" ||
    pathname.startsWith("/player/profile/") ||
    pathname === "/player/skill" ||
    pathname.startsWith("/player/skill/") ||
    pathname === "/player/skill-assessment" ||
    pathname.startsWith("/player/skill-assessment/") ||
    pathname === "/my-club" ||
    pathname.startsWith("/my-club/") ||
    pathname === "/discover-clubs" ||
    pathname.startsWith("/discover-clubs/") ||
    pathname === "/change-password" ||
    pathname.startsWith("/change-password/") ||
    pathname === "/referee" ||
    pathname.startsWith("/referee/match/")
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
