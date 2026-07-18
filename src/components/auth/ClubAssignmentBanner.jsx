import { Alert } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { isClubScopedRole } from "../../auth/roles.js";
import { isClubStorageV2Enabled } from "../../features/club/config/clubRegistryFlags.js";
import { useMyClubMembership } from "../../features/club/hooks/useMyClubMembership.js";

/**
 * Cảnh báo khi user club-scoped chưa có CLB.
 * V2: dùng active membership (club_members). Legacy: profiles.club_id.
 */
export default function ClubAssignmentBanner({ sx = {} }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const membership = useMyClubMembership();

  if (!rbacEnabled || !isAuthenticated || !user?.role) {
    return null;
  }

  if (!isClubScopedRole(user.role)) {
    return null;
  }

  if (isClubStorageV2Enabled()) {
    if (membership.loading || membership.hasActiveMembership || membership.clubId) {
      return null;
    }
    return (
      <Alert severity="warning" sx={{ mb: 2, ...sx }}>
        Tài khoản chưa có CLB đang hoạt động. Hãy gửi yêu cầu gia nhập CLB hoặc liên hệ quản trị viên.
      </Alert>
    );
  }

  if (user.clubId) {
    return null;
  }

  return (
    <Alert severity="warning" sx={{ mb: 2, ...sx }}>
      Tài khoản chưa được gán CLB. Liên hệ quản trị viên để gán <strong>club_id</strong>{" "}
      trên profile trước khi quản lý CLB hoặc giải đấu.
    </Alert>
  );
}
