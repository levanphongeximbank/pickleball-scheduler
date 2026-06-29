import { Navigate, useLocation, Link as RouterLink } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
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

/**
 * Kiểm tra quyền theo route hiện tại.
 * RBAC tắt → cho qua. RBAC bật chưa đăng nhập → chỉ /settings.
 */
export default function RouteAccessGate({ children }) {
  const location = useLocation();
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const { activeClubId, activeClub } = useClub();

  if (!rbacEnabled) {
    return children;
  }

  if (!isAuthenticated) {
    if (location.pathname === "/settings" || location.pathname === "/login") {
      return children;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
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
