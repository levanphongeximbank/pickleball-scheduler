import { Alert } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { isClubScopedRole } from "../../auth/roles.js";
import { useMyClubMembership } from "../../features/club/hooks/useMyClubMembership.js";
import { MEMBERSHIP_PHASE, resolveMembershipPhase } from "../../features/club/membership/membershipState.js";

/**
 * Cảnh báo khi user club-scoped chưa có CLB đang hoạt động.
 * Membership authority luôn là canonical active club_members.
 */
export default function ClubAssignmentBanner({ sx = {} }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const membership = useMyClubMembership();
  const membershipPhase = resolveMembershipPhase(membership);

  if (!rbacEnabled || !isAuthenticated || !user?.role) {
    return null;
  }

  if (!isClubScopedRole(user.role)) {
    return null;
  }

  if (membershipPhase === MEMBERSHIP_PHASE.LOADING || membershipPhase === MEMBERSHIP_PHASE.IDLE) {
    return null;
  }

  if (membershipPhase === MEMBERSHIP_PHASE.ERROR) {
    return (
      <Alert severity="warning" sx={{ mb: 2, ...sx }}>
        Không tải được trạng thái CLB của tài khoản. Vui lòng thử lại hoặc liên hệ quản trị viên.
      </Alert>
    );
  }

  if (membership.hasActiveMembership && membership.clubId) {
    return null;
  }

  return (
    <Alert severity="warning" sx={{ mb: 2, ...sx }}>
      Tài khoản chưa có CLB đang hoạt động. Hãy gửi yêu cầu gia nhập CLB hoặc liên hệ quản trị viên.
    </Alert>
  );
}
