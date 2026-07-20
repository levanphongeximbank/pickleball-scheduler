/**
 * Phase 1G-A — Editable foundation fields for authenticated self profile.
 * identity_verification_status is always read-only (no edit control).
 */
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { SELF_PLAYER_PROFILE_READ_STATUS } from "../services/getAuthenticatedSelfPlayerProfile.js";
import { UNKNOWN_LABEL } from "../selectors/selfProfileDisplay.js";
import {
  SELF_FOUNDATION_HANDEDNESS_OPTIONS,
  SELF_FOUNDATION_PRIVACY_KEYS,
  SELF_FOUNDATION_PRIVACY_LABELS,
} from "../utils/selfFoundationForm.js";

/**
 * @param {object} props
 * @param {string} props.status
 * @param {string|null} [props.message]
 * @param {object|null} [props.form] — buildSelfFoundationFormState result
 * @param {(next: object|((prev: object) => object)) => void} [props.onChange]
 * @param {string|null} [props.verificationLabel]
 * @param {boolean} [props.disabled]
 * @param {() => void} [props.onRetry]
 */
export default function SelfPlayerProfileFoundationEdit({
  status,
  message = null,
  form = null,
  onChange,
  verificationLabel = null,
  disabled = false,
  onRetry,
}) {
  if (status === SELF_PLAYER_PROFILE_READ_STATUS.LOADING) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }} role="status">
        <CircularProgress size={22} />
        <Typography variant="body2" color="text.secondary">
          Đang tải hồ sơ vận động viên…
        </Typography>
      </Stack>
    );
  }

  if (status === SELF_PLAYER_PROFILE_READ_STATUS.UNAUTHORIZED) {
    return (
      <Alert severity="warning">
        {message || "Vui lòng đăng nhập để xem hồ sơ vận động viên."}
      </Alert>
    );
  }

  if (status === SELF_PLAYER_PROFILE_READ_STATUS.PROFILE_NOT_FOUND) {
    return (
      <Alert
        severity="info"
        action={
          onRetry ? (
            <Chip size="small" label="Thử lại" onClick={onRetry} clickable />
          ) : undefined
        }
      >
        {message || "Không tìm thấy hồ sơ."}
      </Alert>
    );
  }

  if (
    status === SELF_PLAYER_PROFILE_READ_STATUS.READ_ERROR ||
    status === SELF_PLAYER_PROFILE_READ_STATUS.UNRESOLVED
  ) {
    return (
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Chip size="small" label="Thử lại" onClick={onRetry} clickable />
          ) : undefined
        }
      >
        {message || "Không đọc được hồ sơ vận động viên."}
      </Alert>
    );
  }

  if (status === SELF_PLAYER_PROFILE_READ_STATUS.EMPTY || !form) {
    return (
      <Alert severity="info">
        {message || "Hồ sơ vận động viên chưa có dữ liệu nền tảng."}
      </Alert>
    );
  }

  const setField = (key, value) => {
    onChange?.((prev) => ({ ...prev, [key]: value }));
  };

  const setRegionField = (key, value) => {
    onChange?.((prev) => ({
      ...prev,
      activityRegion: {
        ...(prev?.activityRegion || {}),
        [key]: value,
      },
    }));
  };

  const setPrivacyFlag = (key, enabled) => {
    onChange?.((prev) => ({
      ...prev,
      privacySettings: {
        ...(prev?.privacySettings || {}),
        [key]: Boolean(enabled),
      },
    }));
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Hồ sơ vận động viên
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Chỉnh sửa dữ liệu chuẩn Player Management. Trạng thái xác minh danh tính chỉ xem.
      </Typography>

      <Stack spacing={2} divider={<Divider flexItem />}>
        <Stack spacing={2}>
          <TextField
            label="Ngày sinh"
            type="date"
            value={form.birthDate || ""}
            onChange={(e) => onChange?.((prev) => {
              const nextDate = e.target.value;
              const yearFromDate =
                nextDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDate)
                  ? nextDate.slice(0, 4)
                  : prev.birthYear;
              return {
                ...prev,
                birthDate: nextDate,
                birthYear: nextDate ? yearFromDate : prev.birthYear,
              };
            })}
            slotProps={{
              inputLabel: { shrink: true },
            }}
            fullWidth
            disabled={disabled}
            helperText="Ngày sinh là nguồn chính; năm sinh sẽ đồng bộ theo ngày."
          />
          <TextField
            label="Năm sinh"
            type="number"
            value={form.birthYear || ""}
            onChange={(e) => setField("birthYear", e.target.value)}
            fullWidth
            disabled={disabled || Boolean(form.birthDate)}
            helperText={
              form.birthDate
                ? "Đã khóa theo ngày sinh (có thể xóa ngày sinh để sửa năm độc lập)."
                : "Cho phép khi chưa có ngày sinh."
            }
            slotProps={{
              htmlInput: {
                min: 1900,
                max: new Date().getFullYear(),
              },
            }}
          />
          <FormControl fullWidth disabled={disabled}>
            <TextField
              select
              label="Tay thuận"
              value={form.handedness || "unknown"}
              onChange={(e) => setField("handedness", e.target.value)}
              disabled={disabled}
            >
              {SELF_FOUNDATION_HANDEDNESS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </FormControl>
        </Stack>

        <Stack spacing={2}>
          <FormLabel component="legend">Khu vực hoạt động</FormLabel>
          <TextField
            label="Tỉnh / Thành phố"
            value={form.activityRegion?.provinceName || ""}
            onChange={(e) => setRegionField("provinceName", e.target.value)}
            fullWidth
            disabled={disabled}
          />
          <TextField
            label="Quận / Huyện / Thành phố"
            value={form.activityRegion?.city || ""}
            onChange={(e) => setRegionField("city", e.target.value)}
            fullWidth
            disabled={disabled}
          />
          <TextField
            label="Phường / Xã"
            value={form.activityRegion?.district || ""}
            onChange={(e) => setRegionField("district", e.target.value)}
            fullWidth
            disabled={disabled}
          />
          <TextField
            label="Mã quốc gia"
            value={form.activityRegion?.countryCode || ""}
            onChange={(e) => setRegionField("countryCode", e.target.value)}
            fullWidth
            disabled={disabled}
            placeholder="VN"
          />
        </Stack>

        <Stack spacing={1}>
          <FormLabel component="legend">Quyền riêng tư</FormLabel>
          <Typography variant="body2" color="text.secondary">
            Mặc định an toàn: hồ sơ công khai tắt. Chỉ bật từng mục khi bạn muốn hiện.
          </Typography>
          {SELF_FOUNDATION_PRIVACY_KEYS.map((key) => (
            <FormControlLabel
              key={key}
              control={
                <Switch
                  checked={Boolean(form.privacySettings?.[key])}
                  onChange={(e) => setPrivacyFlag(key, e.target.checked)}
                  disabled={disabled}
                  size="small"
                />
              }
              label={SELF_FOUNDATION_PRIVACY_LABELS[key] || key}
            />
          ))}
        </Stack>

        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Trạng thái xác minh danh tính (chỉ xem)
          </Typography>
          <Typography variant="body1" fontWeight={600}>
            {verificationLabel || UNKNOWN_LABEL}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
