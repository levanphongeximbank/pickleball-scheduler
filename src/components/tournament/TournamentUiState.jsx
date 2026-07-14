/**
 * S1-H — Shared empty / loading / error UI for Individual Tournament pages.
 */

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { MOBILE_PAGE_GUTTER, touchButtonSx } from "./mobileUi.js";

export function TournamentLoadingState({ label = "Đang tải…" }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ py: 6, px: MOBILE_PAGE_GUTTER }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CircularProgress size={36} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  );
}

export function TournamentEmptyState({
  title = "Chưa có dữ liệu",
  description = "",
  actionLabel = "",
  onAction,
  icon = null,
}) {
  return (
    <Stack
      alignItems="center"
      spacing={1}
      sx={{
        py: 5,
        px: 2,
        textAlign: "center",
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "action.hover",
      }}
      role="status"
    >
      <Box sx={{ color: "text.secondary", display: "flex" }}>
        {icon || <InboxOutlinedIcon fontSize="large" aria-hidden />}
      </Box>
      <Typography fontWeight={700}>{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="contained" onClick={onAction} sx={{ ...touchButtonSx, mt: 1 }}>
          {actionLabel}
        </Button>
      ) : null}
    </Stack>
  );
}

export function TournamentErrorState({
  title = "Có lỗi xảy ra",
  description = "",
  onRetry,
}) {
  return (
    <Alert
      severity="error"
      icon={<ErrorOutlineIcon />}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry} sx={touchButtonSx}>
            Thử lại
          </Button>
        ) : null
      }
      role="alert"
    >
      <Typography fontWeight={700}>{title}</Typography>
      {description ? (
        <Typography variant="body2">{description}</Typography>
      ) : null}
    </Alert>
  );
}
