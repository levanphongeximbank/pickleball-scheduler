import { Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import LockIcon from "@mui/icons-material/Lock";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";

/**
 * Chặn trang setup giải khi RBAC bật và user không có TOURNAMENT_MANAGE.
 */
export default function TournamentManageGate({ children }) {
  const { rbacEnabled, isAuthenticated, can } = useAuth();
  const { activeClubId } = useClub();

  if (!rbacEnabled || !isAuthenticated) {
    return children;
  }

  const allowed = can(PERMISSIONS.TOURNAMENT_MANAGE, { clubId: activeClubId });

  if (allowed) {
    return children;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Stack spacing={2} alignItems="flex-start">
        <LockIcon color="warning" fontSize="large" />
        <Typography variant="h6" fontWeight={700}>
          Không có quyền quản lý giải
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vai trò hiện tại không được phép cấu hình giải đấu. Liên hệ chủ CLB hoặc quản lý sân.
        </Typography>
        <Button component={RouterLink} to="/tournament" variant="contained">
          Về trang Giải đấu
        </Button>
      </Stack>
    </Box>
  );
}
