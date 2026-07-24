import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

export function MessagingLoadingState({ label = "Đang tải…" }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        p: 4,
        minHeight: 160,
      }}
    >
      <CircularProgress size={22} aria-hidden />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export function MessagingEmptyState({ title, description, actionLabel, onAction }) {
  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1,
        p: 4,
        minHeight: 180,
      }}
    >
      <Typography variant="subtitle1">{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      ) : null}
      {actionLabel && onAction ? (
        <Button onClick={onAction} sx={{ mt: 1 }} variant="outlined">
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  );
}

export function MessagingErrorState({ message, onRetry }) {
  return (
    <Box sx={{ p: 2 }}>
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry} aria-label="Thử lại">
              Thử lại
            </Button>
          ) : null
        }
      >
        {message || "Đã xảy ra lỗi"}
      </Alert>
    </Box>
  );
}
