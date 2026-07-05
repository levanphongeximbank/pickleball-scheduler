import { Box, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { formatTrend } from "../services/dashboardService.js";

function TrendBadge({ trendPercent }) {
  const trend = formatTrend(trendPercent);
  const Icon =
    trend.direction === "up"
      ? TrendingUpIcon
      : trend.direction === "down"
        ? TrendingDownIcon
        : TrendingFlatIcon;
  const color =
    trend.direction === "up" ? "success.main" : trend.direction === "down" ? "error.main" : "text.secondary";

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color }}>
      <Icon sx={{ fontSize: 16 }} />
      <Typography variant="caption" fontWeight="bold">
        {trend.label} vs kỳ trước
      </Typography>
    </Stack>
  );
}

export default function KpiCard({ label, value, hint, trendPercent, icon: Icon, accent = "primary.main" }) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        borderRadius: 2.5,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: theme.shell?.cardShadow || 1,
        transition: "box-shadow 0.2s, transform 0.2s",
        "&:hover": {
          boxShadow: theme.shell?.cardShadowHover || 3,
          transform: "translateY(-1px)",
        },
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", mb: 1 }}>
          {Icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: theme.shell?.accentLight || "action.hover",
                color: accent,
                flexShrink: 0,
              }}
            >
              <Icon fontSize="small" />
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={700} sx={{ mt: 0.25 }}>
              {value}
            </Typography>
          </Box>
        </Stack>
        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            {hint}
          </Typography>
        )}
        {typeof trendPercent === "number" && <TrendBadge trendPercent={trendPercent} />}
      </CardContent>
    </Card>
  );
}

export function KpiSection({ title, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
