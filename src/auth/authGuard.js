/**
 * Route guard helpers — auth production (Supabase env) tách khỏi RBAC.
 * RBAC tắt + auth production bật → chỉ cần đăng nhập, không lọc permission.
 */

export function isAuthRequired({ authProductionEnabled, rbacEnabled }) {
  return Boolean(authProductionEnabled || rbacEnabled);
}

/** Path được phép khi chưa đăng nhập. */
export function isPublicAuthPath(pathname, { authProductionEnabled, rbacEnabled }) {
  if (pathname === "/login") {
    return true;
  }

  // Dev RBAC: cho vào Settings để bật/tắt RBAC và đăng nhập dev
  if (rbacEnabled && !authProductionEnabled && pathname === "/settings") {
    return true;
  }

  return false;
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

  return !isPublicAuthPath(pathname, { authProductionEnabled, rbacEnabled });
}
