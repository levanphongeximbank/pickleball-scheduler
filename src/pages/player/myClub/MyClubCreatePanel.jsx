import { useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import ClubFormDialog from "../../clubs/ClubFormDialog.jsx";
import { canSelfRegisterClub } from "../../../features/club/index.js";

export default function MyClubCreatePanel({ tenantId, user, onSuccess }) {
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState(null);

  if (!canSelfRegisterClub(user)) {
    return (
      <Alert severity="info">
        Tài khoản đã được gán CLB hoặc không có quyền tự đăng ký CLB mới.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Bạn có thể đăng ký CLB mới với vai trò Chủ tịch. CLB sẽ ở trạng thái{" "}
        <strong>Chờ chủ sân duyệt</strong> trước khi hoạt động.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setFormOpen(true)}
      >
        Tạo CLB mới
      </Button>

      <ClubFormDialog
        open={formOpen}
        club={null}
        tenantId={tenantId}
        onClose={() => setFormOpen(false)}
        onSuccess={(club) => {
          setFormOpen(false);
          setMessage({
            type: "success",
            text: `Đã tạo CLB ${club.name}. Chờ chủ sân duyệt để hoạt động.`,
          });
          onSuccess?.(club);
        }}
      />
    </Box>
  );
}
