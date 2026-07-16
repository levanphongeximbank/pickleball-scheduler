import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { appendGuestPlayerToClubBlobLegacy } from "../../domain/legacyGuestPlayerBlobWriteAdapter.js";
import { normalizePlayer } from "../../models/player.js";
import { PICK_VN_MAX, PICK_VN_MIN } from "../../features/pick-vn-rating/constants/pickVnRatingScale.js";
import { PLAYER_TYPE } from "../../models/tournament/constants.js";

const defaultForm = {
  name: "",
  gender: "Nam",
  level: 3.5,
  clubName: "",
  phone: "",
};

/**
 * Guest create dialog — does not discover / populate athlete pools.
 * Parent screens must feed pickers from teamTournamentAthletePoolService
 * (or pairing adapters outside Team Tournament). Blob write is isolated
 * via appendGuestPlayerToClubBlobLegacy (non-discovery).
 */
export default function TournamentPlayerQuickAddDialog({
  open,
  onClose,
  hostClubId,
  defaultClubName = "",
  onSaved,
}) {
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...defaultForm,
      clubName: defaultClubName || "",
    });
    setError(null);
  }, [open, defaultClubName]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) {
      setError("Vui lòng nhập họ tên.");
      return;
    }

    if (!hostClubId) {
      setError("Chưa xác định CLB chủ nhà giải.");
      return;
    }

    const level = Number(form.level) || 3.5;
    const player = normalizePlayer({
      id: Date.now(),
      name,
      gender: form.gender,
      level,
      rating: level,
      phone: form.phone.trim(),
      clubName: form.clubName.trim(),
      playerType: PLAYER_TYPE.GUEST,
    });

    if (!player) {
      setError("Không tạo được hồ sơ VĐV.");
      return;
    }

    const written = appendGuestPlayerToClubBlobLegacy(hostClubId, player);
    if (!written.ok) {
      setError(written.error || "Không lưu được VĐV khách (legacy write).");
      return;
    }

    // Guest object is session-local for the open picker; not athlete-pool SSOT.
    onSaved?.(written.player);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Thêm VĐV mới</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            VĐV khách được ghi tạm vào blob CLB chủ nhà (legacy write, không phải
            athlete-pool SSOT). Danh sách ghép cặp / roster vẫn lấy từ pool
            canonical; khách mới chỉ hiện trong phiên picker hiện tại cho đến khi
            được map identity.
          </Typography>
          <TextField
            label="Họ tên"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            select
            label="Giới tính"
            value={form.gender}
            onChange={(event) => updateForm("gender", event.target.value)}
            fullWidth
            required
          >
            <MenuItem value="Nam">Nam</MenuItem>
            <MenuItem value="Nữ">Nữ</MenuItem>
          </TextField>
          <TextField
            label="CLB đại diện (tuỳ chọn)"
            value={form.clubName}
            onChange={(event) => updateForm("clubName", event.target.value)}
            fullWidth
            placeholder="Để trống nếu chưa thuộc CLB nào"
          />
          <TextField
            label="Số điện thoại (tuỳ chọn)"
            value={form.phone}
            onChange={(event) => updateForm("phone", event.target.value)}
            fullWidth
          />
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Level / Rating: {Number(form.level).toFixed(1)}
            </Typography>
            <Slider
              value={Number(form.level) || 3.5}
              min={PICK_VN_MIN}
              max={PICK_VN_MAX}
              step={0.25}
              onChange={(_, value) => updateForm("level", value)}
              valueLabelDisplay="auto"
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" onClick={handleSave}>
          Lưu VĐV
        </Button>
      </DialogActions>
    </Dialog>
  );
}
