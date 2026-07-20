/**
 * Phase 1H-C — Admin Player verification actions page.
 * Narrow route adjacent to User Management (/users).
 * Authorization is enforced by queue/write APIs; route gate is UX only.
 */
import { Box, Typography } from "@mui/material";

import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import AdminPlayerVerificationQueue from "../features/player/components/AdminPlayerVerificationQueue.jsx";

export default function AdminPlayerVerificationPage() {
  return (
    <PermissionGate
      permission={PERMISSIONS.USER_MANAGE}
      fallback={
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Xác minh VĐV
          </Typography>
          <Typography color="text.secondary">
            Bạn không có quyền quản lý xác minh hồ sơ vận động viên.
          </Typography>
        </Box>
      }
    >
      <Box sx={{ p: { xs: 1.5, md: 2 } }}>
        <AdminPlayerVerificationQueue />
      </Box>
    </PermissionGate>
  );
}
