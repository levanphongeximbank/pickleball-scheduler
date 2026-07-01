import { Box, Stack, Typography } from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";

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
      <Icon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
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
    <Stack spacing={2}>
      {[1, 2, 3].map((row) => (
        <Box
          key={row}
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
    </Stack>
  );
}

export function DashboardErrorState({ message, onRetry }) {
  return (
    <Box
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
        <Typography
          component="button"
          variant="body2"
          onClick={onRetry}
          sx={{
            border: 0,
            bgcolor: "transparent",
            color: "primary.main",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Thử lại
        </Typography>
      )}
    </Box>
  );
}

export { LEVEL_COLORS, LEVEL_LABELS };
