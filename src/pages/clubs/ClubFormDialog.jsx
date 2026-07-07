import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
} from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES, normalizeRole } from "../../auth/roles.js";
import { loadCourtsForVenueScoped } from "../../domain/courtService.js";
import { CLUB_STATUSES } from "../../features/club/index.js";
import { createClub, updateClub } from "../../features/club/index.js";

const defaultForm = {
  name: "",
  code: "",
  description: "",
  status: CLUB_STATUSES.ACTIVE,
  presidentUserId: "",
  vicePresidentUserId: "",
  registeredCourtIds: [],
  assignOwnerToCreator: true,
};

export default function ClubFormDialog({ open, club, tenantId, onClose, onSuccess }) {
  const { user } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(club?.id);
  const isCourtOwner = normalizeRole(user?.role) === ROLES.TENANT_OWNER;
  const isClubManager = normalizeRole(user?.role) === ROLES.CLUB_MANAGER;

  const venueCourts = useMemo(
    () => (tenantId ? loadCourtsForVenueScoped(tenantId, tenantId) : []),
    [tenantId]
  );

  useEffect(() => {
    if (!open) return;
    if (club) {
      setForm({
        name: club.name || "",
        code: club.code || "",
        description: club.description || "",
        status: club.status || CLUB_STATUSES.ACTIVE,
        presidentUserId: club.governance?.presidentUserId || "",
        vicePresidentUserId: club.governance?.vicePresidentUserId || "",
        registeredCourtIds: club.governance?.registeredCourtIds || [],
        assignOwnerToCreator: true,
      });
    } else {
      setForm({
        ...defaultForm,
        presidentUserId: isClubManager ? user?.id || "" : "",
        assignOwnerToCreator: isCourtOwner,
      });
    }
    setError(null);
  }, [open, club, user, isClubManager, isCourtOwner]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const presidentUserId = form.presidentUserId.trim() || (isClubManager ? user?.id : "");
    if (!isEdit && !presidentUserId) {
      setSaving(false);
      setError("Chủ tịch CLB bắt buộc — nhập user ID Chủ tịch.");
      return;
    }

    const governance = {
      presidentUserId: presidentUserId || club?.governance?.presidentUserId,
      ownerUserId: club?.governance?.ownerUserId ?? null,
      vicePresidentUserId: form.vicePresidentUserId.trim() || null,
      registeredCourtIds: form.registeredCourtIds,
    };

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim(),
      status: form.status,
      tenantId,
      assignOwnerToCreator: form.assignOwnerToCreator,
      governance,
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
          {!isEdit && isClubManager && (
            <Alert severity="info">
              CLB do Chủ tịch tự đăng ký sẽ ở trạng thái <strong>Chờ chủ sân duyệt</strong> trước khi
              hoạt động.
            </Alert>
          )}
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
          {!isEdit && (
            <TextField
              label="User ID Chủ tịch"
              required
              value={form.presidentUserId}
              onChange={(e) => setForm((f) => ({ ...f, presidentUserId: e.target.value }))}
              helperText={
                isClubManager
                  ? "Mặc định là tài khoản của bạn"
                  : "Bắt buộc — auth user id của Chủ tịch CLB"
              }
              disabled={isClubManager}
            />
          )}
          <TextField
            label="User ID Phó chủ tịch"
            value={form.vicePresidentUserId}
            onChange={(e) => setForm((f) => ({ ...f, vicePresidentUserId: e.target.value }))}
            helperText="Tùy chọn"
          />
          <FormControl fullWidth>
            <InputLabel>Cụm sân đăng ký</InputLabel>
            <Select
              multiple
              value={form.registeredCourtIds}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  registeredCourtIds:
                    typeof e.target.value === "string"
                      ? e.target.value.split(",")
                      : e.target.value,
                }))
              }
              input={<OutlinedInput label="Cụm sân đăng ký" />}
              renderValue={(selected) =>
                selected
                  .map((id) => venueCourts.find((c) => c.id === id)?.name || id)
                  .join(", ")
              }
            >
              {venueCourts.length === 0 && (
                <MenuItem disabled>Chưa có sân trong venue</MenuItem>
              )}
              {venueCourts.map((court) => (
                <MenuItem key={court.id} value={court.id}>
                  <ListItemText
                    primary={court.name || court.id}
                    secondary={court.clubName ? `CLB: ${court.clubName}` : undefined}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!isEdit && isCourtOwner && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.assignOwnerToCreator}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assignOwnerToCreator: e.target.checked }))
                  }
                />
              }
              label="Tôi là Chủ sở hữu CLB"
            />
          )}
          {isEdit && (
            <TextField
              select
              label="Trạng thái"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <MenuItem value={CLUB_STATUSES.ACTIVE}>Đang hoạt động</MenuItem>
              <MenuItem value={CLUB_STATUSES.PENDING_SETUP}>Chờ thiết lập</MenuItem>
              <MenuItem value={CLUB_STATUSES.PENDING_APPROVAL}>Chờ chủ sân duyệt</MenuItem>
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
