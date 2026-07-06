import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import {
  isAuthenticatedOnlyRoute,
  isPermissionExemptPath,
  shouldRedirectToLogin,
  shouldRedirectToForbidden,
} from "../../auth/authGuard.js";
import { getDefaultHomePath, resolveRouteAccessScope } from "../../auth/menuAccess.js";

function AuthLoading() {
  return (
    <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
      <CircularProgress size={28} />
    </Box>
  );
}

/**
 * Auth production (Supabase env) → bắt đăng nhập.
 * RBAC bật → lọc menu/route theo quyền; từ chối → /403.
 */
export default function RouteAccessGate({ children }) {
  const location = useLocation();
  const {
    authLoading,
    authProductionEnabled,
    can,
    rbacEnabled,
    isAuthenticated,
    user,
  } = useAuth();
  const { activeClubId, activeClub } = useClub();

  if (authLoading && location.pathname !== "/login") {
    return <AuthLoading />;
  }

  if (
    shouldRedirectToLogin(location.pathname, {
      authProductionEnabled,
      rbacEnabled,
      isAuthenticated,
    })
  ) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (
    authProductionEnabled &&
    isAuthenticatedOnlyRoute(location.pathname) &&
    !isAuthenticated
  ) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!rbacEnabled) {
    return children;
  }

  if (!isAuthenticated) {
    return children;
  }

  const scope = resolveRouteAccessScope({
    user,
    activeClubId,
    activeClub,
  });

  const homePath = getDefaultHomePath(user, rbacEnabled);

  if (location.pathname === "/" && user?.role && homePath !== "/") {
    return <Navigate to={homePath} replace />;
  }

  if (location.pathname === "/dashboard" && user?.role && homePath !== "/" && homePath !== "/dashboard") {
    return <Navigate to={homePath} replace />;
  }

  if (isPermissionExemptPath(location.pathname)) {
    return children;
  }

  if (isAuthenticatedOnlyRoute(location.pathname)) {
    return children;
  }

  if (
    shouldRedirectToForbidden(location.pathname, {
      rbacEnabled,
      isAuthenticated,
      can,
      scope,
    })
  ) {
    if (location.pathname !== "/403") {
      if (
        homePath &&
        homePath !== location.pathname &&
        !shouldRedirectToForbidden(homePath, {
          rbacEnabled,
          isAuthenticated,
          can,
          scope,
        })
      ) {
        return <Navigate to={homePath} replace />;
      }
      return <Navigate to="/403" replace state={{ from: location }} />;
    }
  }

  return children;
}
