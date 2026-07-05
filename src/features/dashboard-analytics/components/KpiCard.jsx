import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";

import { formatTrend } from "../services/dashboardService.js";
import { DASHBOARD_LAYOUT, dashboardCardContentSx, dashboardCardSx } from "../constants/dashboardLayout.js";

export default function KpiCard({ label, value, hint, trendPercent, icon: Icon, accent = "primary.main", compactTrend = false }) {
  const theme = useTheme();
  const trend = typeof trendPercent === "number" ? formatTrend(trendPercent) : null;
  const trendColor =
    trend?.direction === "up"
      ? "success.main"
      : trend?.direction === "down"
        ? "error.main"
        : "text.secondary";

  return (
    <Card elevation={0} sx={dashboardCardSx}>
      <CardContent sx={dashboardCardContentSx}>
        {Icon && (
          <Box
            sx={{
              width: DASHBOARD_LAYOUT.kpiIconSize,
              height: DASHBOARD_LAYOUT.kpiIconSize,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: theme.shell?.accentLight || "#ECFDF5",
              color: accent,
              mb: 1.25,
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, mb: 0.25 }}>
          {label}
        </Typography>

        <Typography
          fontWeight={700}
          sx={{
            fontSize: { xs: 22, lg: 24 },
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            mb: trend ? 0.75 : 0,
          }}
        >
          {value}
        </Typography>

        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            {hint}
          </Typography>
        )}

        {trend && (
          <Typography variant="caption" fontWeight={700} sx={{ color: trendColor, fontSize: 12 }}>
            {compactTrend ? trend.label : `${trend.label} vs kỳ trước`}
          </Typography>
        )}
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
