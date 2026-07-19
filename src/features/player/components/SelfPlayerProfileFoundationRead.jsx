/**
 * Phase 1F-A — Read-only foundation fields for authenticated self profile.
 * identity_verification_status is always non-editable.
 */
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { SELF_PLAYER_PROFILE_READ_STATUS } from "../services/getAuthenticatedSelfPlayerProfile.js";
import { UNKNOWN_LABEL } from "../selectors/selfProfileDisplay.js";

function FieldRow({ label, value, empty, readOnly }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 0.75,
        py: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: { sm: 160 } }}>
        {label}
        {readOnly ? " (chỉ xem)" : ""}
      </Typography>
      <Typography
        variant="body1"
        fontWeight={empty ? 400 : 600}
        color={empty ? "text.secondary" : "text.primary"}
        sx={{ textAlign: { xs: "left", sm: "right" }, wordBreak: "break-word" }}
      >
        {value || UNKNOWN_LABEL}
      </Typography>
    </Box>
  );
}

/**
 * @param {object} props
 * @param {string} props.status
 * @param {string|null} [props.message]
 * @param {object|null} [props.fields] — buildSelfFoundationFieldView result
 * @param {() => void} [props.onRetry]
 */
export default function SelfPlayerProfileFoundationRead({
  status,
  message = null,
  fields = null,
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

  if (status === SELF_PLAYER_PROFILE_READ_STATUS.EMPTY || !fields) {
    return (
      <Alert severity="info">
        {message || "Hồ sơ vận động viên chưa có dữ liệu nền tảng."}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Hồ sơ vận động viên
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Dữ liệu chuẩn từ Player Management (chỉ đọc trong giai đoạn 1F-A).
      </Typography>

      <Stack divider={<Divider flexItem />} spacing={0}>
        <FieldRow
          label="Năm sinh"
          value={fields.birthYear.label}
          empty={fields.birthYear.empty}
        />
        <FieldRow
          label="Ngày sinh"
          value={fields.birthDate.label}
          empty={fields.birthDate.empty}
        />
        <FieldRow
          label="Tay thuận"
          value={fields.handedness.label}
          empty={fields.handedness.empty}
        />
        <FieldRow
          label="Khu vực hoạt động"
          value={fields.activityRegion.label}
          empty={fields.activityRegion.empty}
        />
        <Box sx={{ py: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Quyền riêng tư
          </Typography>
          <Typography
            variant="body1"
            fontWeight={fields.privacySettings.empty ? 400 : 600}
            color={fields.privacySettings.empty ? "text.secondary" : "text.primary"}
            sx={{ mb: fields.privacySettings.flags?.length ? 1 : 0 }}
          >
            {fields.privacySettings.label}
          </Typography>
          {fields.privacySettings.flags?.length > 0 && (
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
              {fields.privacySettings.flags.map((flag) => (
                <Chip
                  key={flag.key}
                  size="small"
                  variant={flag.enabled ? "filled" : "outlined"}
                  color={flag.enabled ? "primary" : "default"}
                  label={`${flag.label}: ${flag.enabled ? "Bật" : "Tắt"}`}
                />
              ))}
            </Stack>
          )}
        </Box>
        <FieldRow
          label="Trạng thái xác minh danh tính"
          value={fields.identityVerificationStatus.label}
          empty={false}
          readOnly
        />
      </Stack>
    </Box>
  );
}
