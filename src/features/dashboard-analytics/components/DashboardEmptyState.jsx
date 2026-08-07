import { Box, Button, Stack, Typography } from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { getTechnicalReasonUserMessage } from "../../canonical-shell/config/canonicalVietnameseLabels.js";

const LEVEL_COLORS = {
  low: "#e8f5e9",
  medium: "#fff9c4",
  high: "#ffcc80",
  very_high: "#ef5350",
};

const LEVEL_LABELS = {
  low: "Ít sử dụng",
  medium: "Trung bình",
  high: "Đông",
  very_high: "Rất đông",
};

export default function DashboardEmptyState({ title, description, icon: Icon = InsightsOutlinedIcon }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        py: 5,
        px: 2,
        textAlign: "center",
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "grey.50",
      }}
    >
      <Icon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} aria-hidden />
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

export function DashboardLoadingState() {
  return (
    <Stack
      spacing={2}
      role="status"
      aria-busy="true"
      aria-label="Đang tải dashboard"
    >
      {[1, 2, 3].map((row) => (
        <Box
          key={row}
          aria-hidden
          sx={{
            height: 96,
            borderRadius: 2,
            bgcolor: "action.hover",
            animation: "pulse 1.4s ease-in-out infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 0.55 },
              "50%": { opacity: 1 },
            },
          }}
        />
      ))}
      <Typography variant="body2" color="text.secondary">
        Đang tải dữ liệu dashboard…
      </Typography>
    </Stack>
  );
}

export function DashboardErrorState({ message, onRetry }) {
  return (
    <Box
      role="alert"
      sx={{
        p: 3,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "error.light",
        bgcolor: "error.50",
      }}
    >
      <Typography color="error.main" fontWeight="bold" sx={{ mb: 1 }}>
        Không tải được dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {message}
      </Typography>
      {onRetry && (
        <Button variant="outlined" size="small" onClick={onRetry} aria-label="Thử lại tải dashboard">
          Thử lại
        </Button>
      )}
    </Box>
  );
}

export function DashboardUnavailableState({ message, reason }) {
  const reasonMessage = reason ? getTechnicalReasonUserMessage(reason) : null;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        p: 3,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "warning.light",
        bgcolor: "warning.50",
      }}
    >
      <Typography fontWeight="bold" sx={{ mb: 1 }}>
        Nguồn tổng quan chưa khả dụng
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {message || "Hệ thống báo cáo hoặc nguồn dữ liệu chưa được cấu hình."}
      </Typography>
      {reasonMessage && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Lý do: {reasonMessage}
        </Typography>
      )}
    </Box>
  );
}

export { LEVEL_COLORS, LEVEL_LABELS };
