import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import ClubFormDialog from "../../clubs/ClubFormDialog.jsx";
import { canSelfRegisterClub } from "../../../features/club/index.js";
import { listTenants } from "../../../features/tenant/index.js";

export default function MyClubCreatePanel({ tenantId, user, onSuccess }) {
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId || "");

  const tenants = useMemo(() => listTenants(), []);
  const effectiveTenantId = tenantId || selectedTenantId || "";

  if (!canSelfRegisterClub(user)) {
    return (
      <Alert severity="info">
        Tài khoản đã được gán CLB hoặc không có quyền tự đăng ký CLB mới.
      </Alert>
    );
  }

  const handleOpenForm = () => {
    if (!effectiveTenantId) {
      setMessage({
        type: "warning",
        text: "Vui lòng chọn cơ sở / tổ chức trước khi tạo CLB.",
      });
      return;
    }
    setFormOpen(true);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Bạn có thể tạo CLB mới và trở thành <strong>Chủ tịch CLB</strong>. CLB sẽ{" "}
        <strong>hoạt động ngay</strong> sau khi tạo — bạn có thể thêm thành viên và duyệt yêu cầu
        tham gia.
      </Typography>

      {!tenantId && tenants.length > 0 && (
        <FormControl fullWidth sx={{ mb: 2, maxWidth: 420 }}>
          <InputLabel>Cơ sở / tổ chức</InputLabel>
          <Select
            value={selectedTenantId}
            label="Cơ sở / tổ chức"
            onChange={(event) => setSelectedTenantId(event.target.value)}
          >
            {tenants.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name || item.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {!tenantId && tenants.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Chưa có cơ sở nào trong hệ thống. Liên hệ quản trị viên để được hỗ trợ tạo CLB.
        </Alert>
      )}

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleOpenForm}
        disabled={!effectiveTenantId && tenants.length === 0}
      >
        Tạo CLB mới
      </Button>

      <ClubFormDialog
        open={formOpen}
        club={null}
        tenantId={effectiveTenantId}
        onClose={() => setFormOpen(false)}
        onSuccess={(club) => {
          setFormOpen(false);
          setMessage({
            type: "success",
            text: `Đã tạo CLB ${club.name}. Bạn là Chủ tịch CLB.`,
          });
          onSuccess?.(club);
        }}
      />
    </Box>
  );
}
