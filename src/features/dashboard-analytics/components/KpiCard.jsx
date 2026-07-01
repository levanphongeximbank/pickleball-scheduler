import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
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
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 2,
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 2 },
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", mb: 1 }}>
          {Icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: `${accent}14`,
                color: accent,
              }}
            >
              <Icon fontSize="small" />
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ mt: 0.25 }}>
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
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
