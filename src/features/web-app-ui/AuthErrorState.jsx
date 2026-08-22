/**
 * AuthErrorState — authenticated error / retry pattern (Wave 2 Batch 2D).
 *
 * Does not show raw developer/backend stack by default.
 * Not a 403 authorization page — permission visuals stay separate.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";

/**
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} props.message — user-safe copy (domain-supplied)
 * @param {string} [props.retryLabel]
 * @param {() => void} [props.onRetry]
 * @param {string} [props.referenceCode] — optional user-safe reference only
 */
export default function AuthErrorState({
  title = "Không tải được dữ liệu",
  message,
  retryLabel = "Thử lại",
  onRetry,
  referenceCode,
  sx = {},
}) {
  return (
    <Box
      role="alert"
      data-testid="auth-error-state"
      aria-label={title}
      sx={{
        py: 5,
        px: 2,
        textAlign: "center",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "error.light",
        bgcolor: "background.paper",
        ...sx,
      }}
    >
      <ErrorOutlinedIcon sx={{ fontSize: 48, color: "error.main", mb: 1 }} aria-hidden />
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: "auto" }}>
        {message}
      </Typography>
      {referenceCode ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
          Mã tham chiếu: {referenceCode}
        </Typography>
      ) : null}
      {onRetry ? (
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <Button variant="contained" color="primary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
