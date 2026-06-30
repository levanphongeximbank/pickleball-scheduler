import { Navigate, useLocation, Link as RouterLink } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { shouldRedirectToLogin } from "../../auth/authGuard.js";
import { canAccessRoute, getDefaultHomePath } from "../../auth/menuAccess.js";

function AccessDenied({ homePath }) {
  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <LockIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Không có quyền truy cập
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Tài khoản hiện tại không được phép xem trang này.
      </Typography>
      <Button component={RouterLink} to={homePath} variant="outlined">
        Về trang chính
      </Button>
    </Box>
  );
}

function AuthLoading() {
  return (
    <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
      <CircularProgress size={28} />
    </Box>
  );
}

/**
 * Auth production (Supabase env) → bắt đăng nhập.
 * RBAC bật → lọc menu/route theo quyền (có thể tách khỏi auth production).
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

  if (authLoading) {
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

  if (!rbacEnabled) {
    return children;
  }

  if (!isAuthenticated) {
    return children;
  }

  const scope = {
    clubId: activeClubId,
    venueId: activeClub?.venueId || user?.venueId || null,
    playerId: user?.playerId || null,
  };

  const homePath = getDefaultHomePath(user, rbacEnabled);

  if (location.pathname === "/" && user?.role && homePath !== "/") {
    return <Navigate to={homePath} replace />;
  }

  if (canAccessRoute(can, location.pathname, scope)) {
    return children;
  }

  if (location.pathname !== homePath) {
    return <AccessDenied homePath={homePath} />;
  }

  return children;
}
