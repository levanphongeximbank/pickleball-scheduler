import { Alert } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { isClubScopedRole } from "../../auth/roles.js";

/**
 * Cảnh báo khi user club-scoped (CLUB_MANAGER, PLAYER) chưa có profiles.club_id.
 */
export default function ClubAssignmentBanner({ sx = {} }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();

  if (!rbacEnabled || !isAuthenticated || !user?.role) {
    return null;
  }

  if (!isClubScopedRole(user.role) || user.clubId) {
    return null;
  }

  return (
    <Alert severity="warning" sx={{ mb: 2, ...sx }}>
      Tài khoản chưa được gán CLB. Liên hệ quản trị viên để gán <strong>club_id</strong>{" "}
      trên profile trước khi quản lý CLB hoặc giải đấu.
    </Alert>
  );
}
