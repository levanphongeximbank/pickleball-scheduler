import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

import { CLUB_STATUSES } from "../../features/club/index.js";
import { createClub, updateClub } from "../../features/club/index.js";

const defaultForm = {
  name: "",
  code: "",
  description: "",
  status: CLUB_STATUSES.ACTIVE,
};

export default function ClubFormDialog({ open, club, tenantId, onClose, onSuccess }) {
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(club?.id);

  useEffect(() => {
    if (!open) return;
    if (club) {
      setForm({
        name: club.name || "",
        code: club.code || "",
        description: club.description || "",
        status: club.status || CLUB_STATUSES.ACTIVE,
      });
    } else {
      setForm(defaultForm);
    }
    setError(null);
  }, [open, club]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim(),
      status: form.status,
      tenantId,
    };

    const result = isEdit
      ? updateClub(club.id, payload, tenantId)
      : createClub(payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSuccess?.(result.club);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Chỉnh sửa CLB" : "Tạo CLB mới"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Tên CLB"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={Boolean(error && !form.name.trim())}
          />
          <TextField
            label="Mã CLB"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            helperText="Tùy chọn — không trùng trong cùng tenant"
          />
          <TextField
            label="Mô tả"
            multiline
            minRows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          {isEdit && (
            <TextField
              select
              label="Trạng thái"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <MenuItem value={CLUB_STATUSES.ACTIVE}>Đang hoạt động</MenuItem>
              <MenuItem value={CLUB_STATUSES.INACTIVE}>Vô hiệu hóa</MenuItem>
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !form.name.trim()}>
          {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo CLB"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
