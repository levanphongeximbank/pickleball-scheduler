import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "../services/dashboardService.js";
import DashboardEmptyState from "./DashboardEmptyState.jsx";
import {
  DASHBOARD_LAYOUT,
  dashboardCardContentSx,
  dashboardCardSx,
  dashboardSectionTitleSx,
} from "../constants/dashboardLayout.js";

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        boxShadow: 2,
      }}
    >
      <Typography variant="caption" fontWeight="bold" sx={{ display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ display: "block", color: "primary.main" }}>
        {formatCurrency(payload[0]?.value)}
      </Typography>
    </Box>
  );
}

export default function RevenueChart({ series = [] }) {
  const theme = useTheme();

  if (!series.length) {
    return (
      <Card variant="outlined" sx={dashboardCardSx}>
        <CardContent sx={dashboardCardContentSx}>
          <Typography sx={{ ...dashboardSectionTitleSx, mb: 2 }}>Doanh thu</Typography>
          <DashboardEmptyState
            title="Chưa có dữ liệu doanh thu"
            description="Thêm booking hoặc giao dịch để xem biểu đồ."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ ...dashboardCardSx, minHeight: DASHBOARD_LAYOUT.analyticsMinHeight }}>
      <CardContent sx={dashboardCardContentSx}>
        <Typography sx={{ ...dashboardSectionTitleSx, mb: 2 }}>Doanh thu</Typography>
        <Box sx={{ width: "100%", height: DASHBOARD_LAYOUT.chartHeight }}>
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueTotalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                width={68}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                name="Doanh thu"
                stroke={theme.palette.primary.main}
                strokeWidth={2.5}
                fill="url(#revenueTotalGradient)"
                dot={{ r: 3, fill: theme.palette.primary.main, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
