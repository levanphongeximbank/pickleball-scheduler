import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useCluster } from "../../context/ClusterContext.jsx";
import {
  isAuthenticatedOnlyRoute,
  isPermissionExemptPath,
  shouldRedirectToForcePasswordChange,
  shouldRedirectToLogin,
  shouldRedirectToForbidden,
  shouldRenderRouteAuthLoading,
  userMustChangePassword,
} from "../../auth/authGuard.js";
import { getDefaultHomePath, resolveRouteAccessScope } from "../../auth/menuAccess.js";
import { decideTournamentEngineRouteGate } from "../../auth/tournamentEngineRouteAccess.js";
import { isClubStorageV2Enabled } from "../../features/club/config/clubRegistryFlags.js";
import { isTeamTournamentPortalPath } from "../../features/team-tournament/routing/teamPortalRouteScope.js";
import { ROLES, normalizeRole } from "../../auth/roles.js";
import ClubPlayerHomeRedirect from "../../pages/player/guards/ClubPlayerHomeRedirect.jsx";

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
  const { activeClusterId } = useCluster();

  if (
    shouldRenderRouteAuthLoading({
      authLoading,
      isAuthenticated,
      pathname: location.pathname,
    })
  ) {
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

  if (isAuthenticated && user) {
    if (userMustChangePassword(user) && shouldRedirectToForcePasswordChange(location.pathname, user)) {
      return <Navigate to="/change-password" replace />;
    }

    if (!userMustChangePassword(user) && location.pathname === "/change-password") {
      const homePath = getDefaultHomePath(user, rbacEnabled);
      return <Navigate to={homePath || "/"} replace />;
    }
  }

  if (
    authProductionEnabled &&
    isAuthenticatedOnlyRoute(location.pathname) &&
    !isAuthenticated
  ) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Phase 4 OD-PLURAL-AUTHZ — Engine: auth + tournament.update + ownership whenever auth is
  // active, independent of VITE_RBAC_ENABLED (BR-PLURAL-01 remediation).
  {
    const engineScope = resolveRouteAccessScope({
      user,
      activeClubId,
      activeClub,
      activeClusterId,
      pathname: location.pathname,
    });
    const engineDecision = decideTournamentEngineRouteGate({
      pathname: location.pathname,
      user,
      isAuthenticated,
      scope: engineScope,
      activeClubId,
      authProductionEnabled,
      rbacEnabled,
      tenantId: user?.tenantId || user?.venueId || activeClub?.venueId || null,
    });
    if (engineDecision.apply) {
      if (engineDecision.redirect === "login") {
        return <Navigate to="/login" replace state={{ from: location }} />;
      }
      if (!engineDecision.ok) {
        return (
          <Navigate
            to="/403"
            replace
            state={{ from: location, reason: engineDecision.code }}
          />
        );
      }
    }
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
    activeClusterId,
    pathname: location.pathname,
  });

  const homePath = getDefaultHomePath(user, rbacEnabled);

  if (location.pathname === "/dashboard" && user?.role && homePath !== "/dashboard") {
    if (isClubStorageV2Enabled() && normalizeRole(user.role) === ROLES.PLAYER) {
      return <ClubPlayerHomeRedirect />;
    }
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
      user,
    })
  ) {
    if (location.pathname !== "/403") {
      const portalDeepLink = isTeamTournamentPortalPath(location.pathname);
      if (
        !portalDeepLink &&
        homePath &&
        homePath !== location.pathname &&
        !shouldRedirectToForbidden(homePath, {
          rbacEnabled,
          isAuthenticated,
          can,
          scope,
          user,
        })
      ) {
        return <Navigate to={homePath} replace />;
      }
      return <Navigate to="/403" replace state={{ from: location }} />;
    }
  }

  return children;
}
