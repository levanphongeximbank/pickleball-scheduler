/**
 * Public Portal presentation state primitives (EC-02).
 * Display-only — no data fetching, routing, retry loops, or competition logic.
 */

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { PUBLIC_COLORS } from "../publicPortalStyles.js";

const rootSx = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 1.25,
  px: { xs: 2, sm: 3 },
  py: { xs: 4, md: 5 },
  minHeight: { xs: 160, md: 200 },
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const titleSx = {
  fontWeight: 700,
  color: PUBLIC_COLORS.text,
  maxWidth: 520,
};

const messageSx = {
  color: PUBLIC_COLORS.textMuted,
  maxWidth: 520,
  lineHeight: 1.6,
};

const actionSx = {
  mt: 1,
  minHeight: 44,
  minWidth: 44,
  px: 2.5,
  textTransform: "none",
  fontWeight: 600,
  borderColor: PUBLIC_COLORS.border,
  color: PUBLIC_COLORS.text,
  "&:hover": {
    borderColor: PUBLIC_COLORS.primary,
    bgcolor: "rgba(16,185,129,0.08)",
  },
  "&:focus-visible": {
    outline: `2px solid ${PUBLIC_COLORS.lime}`,
    outlineOffset: 2,
  },
};

/**
 * @param {{ title?: string, message?: string }} props
 */
export function PublicLoadingState({
  title = "Đang tải…",
  message = "",
}) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="public-loading-state"
      sx={rootSx}
    >
      <CircularProgress
        size={28}
        aria-hidden
        sx={{ color: PUBLIC_COLORS.primary }}
      />
      <Typography component="h2" variant="subtitle1" sx={titleSx}>
        {title}
      </Typography>
      {message ? (
        <Typography variant="body2" sx={messageSx}>
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   actionLabel?: string,
 *   onAction?: () => void,
 * }} props
 */
export function PublicEmptyState({
  title = "Chưa có dữ liệu",
  message = "",
  actionLabel = "",
  onAction,
}) {
  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="public-empty-state"
      sx={{
        ...rootSx,
        border: `1px dashed ${PUBLIC_COLORS.border}`,
        borderRadius: 2,
        bgcolor: "rgba(255,255,255,0.02)",
      }}
    >
      <InboxOutlinedIcon
        aria-hidden
        sx={{ fontSize: 40, color: PUBLIC_COLORS.textMuted }}
      />
      <Typography component="h2" variant="subtitle1" sx={titleSx}>
        {title}
      </Typography>
      {message ? (
        <Typography variant="body2" sx={messageSx}>
          {message}
        </Typography>
      ) : null}
      {actionLabel && typeof onAction === "function" ? (
        <Button
          variant="outlined"
          onClick={onAction}
          aria-label={actionLabel}
          sx={actionSx}
        >
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  );
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   actionLabel?: string,
 *   onAction?: () => void,
 * }} props
 */
export function PublicErrorState({
  title = "Không tải được nội dung",
  message = "Đã xảy ra lỗi khi hiển thị dữ liệu công khai. Vui lòng thử lại sau.",
  actionLabel = "",
  onAction,
}) {
  return (
    <Box
      data-testid="public-error-state"
      sx={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
    >
      <Alert
        severity="error"
        role="alert"
        icon={<ErrorOutlineIcon aria-hidden />}
        sx={{
          alignItems: "flex-start",
          width: "100%",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          bgcolor: "rgba(239,68,68,0.12)",
          color: PUBLIC_COLORS.text,
          border: "1px solid rgba(248,113,113,0.35)",
          "& .MuiAlert-message": { width: "100%" },
        }}
        action={
          actionLabel && typeof onAction === "function" ? (
            <Button
              color="inherit"
              size="small"
              onClick={onAction}
              aria-label={actionLabel}
              sx={{
                minHeight: 44,
                minWidth: 44,
                textTransform: "none",
                fontWeight: 600,
                "&:focus-visible": {
                  outline: `2px solid ${PUBLIC_COLORS.lime}`,
                  outlineOffset: 2,
                },
              }}
            >
              {actionLabel}
            </Button>
          ) : null
        }
      >
        <Typography component="h2" variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        {message ? (
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
            {message}
          </Typography>
        ) : null}
      </Alert>
    </Box>
  );
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   actionLabel?: string,
 *   onAction?: () => void,
 * }} props
 */
export function PublicUnavailableState({
  title = "Nội dung tạm thời không khả dụng",
  message = "Phần nội dung này hiện chưa sẵn sàng để xem công khai.",
  actionLabel = "",
  onAction,
}) {
  return (
    <Stack
      role="status"
      aria-live="polite"
      data-testid="public-unavailable-state"
      spacing={1.25}
      alignItems="center"
      sx={{
        ...rootSx,
        border: `1px solid ${PUBLIC_COLORS.border}`,
        borderRadius: 2,
        bgcolor: "rgba(255,255,255,0.03)",
      }}
    >
      <InfoOutlinedIcon
        aria-hidden
        sx={{ fontSize: 40, color: PUBLIC_COLORS.accent }}
      />
      <Typography component="h2" variant="subtitle1" sx={titleSx}>
        {title}
      </Typography>
      {message ? (
        <Typography variant="body2" sx={messageSx}>
          {message}
        </Typography>
      ) : null}
      {actionLabel && typeof onAction === "function" ? (
        <Button
          variant="outlined"
          onClick={onAction}
          aria-label={actionLabel}
          sx={actionSx}
        >
          {actionLabel}
        </Button>
      ) : null}
    </Stack>
  );
}
