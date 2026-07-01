import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "../services/dashboardService.js";
import DashboardEmptyState from "./DashboardEmptyState.jsx";

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
      {payload.map((entry) => (
        <Typography key={entry.dataKey} variant="caption" sx={{ display: "block", color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </Typography>
      ))}
    </Box>
  );
}

export default function RevenueChart({ series = [] }) {
  const theme = useTheme();

  if (!series.length) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Doanh thu theo thời gian
          </Typography>
          <DashboardEmptyState
            title="Chưa có dữ liệu doanh thu"
            description="Thêm booking hoặc giao dịch để xem biểu đồ."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
          Doanh thu theo thời gian
        </Typography>
        <Box sx={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bookingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} width={72} tick={{ fontSize: 11 }} />
              <Tooltip content={<RevenueTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="booking"
                name="Đặt sân"
                stackId="1"
                stroke={theme.palette.primary.main}
                fill="url(#bookingGradient)"
              />
              <Area
                type="monotone"
                dataKey="tournament"
                name="Giải đấu"
                stackId="1"
                stroke={theme.palette.secondary.main}
                fill={theme.palette.secondary.light}
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="membership"
                name="Hội viên"
                stackId="1"
                stroke={theme.palette.success.main}
                fill={theme.palette.success.light}
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="other"
                name="Khác"
                stackId="1"
                stroke={theme.palette.warning.main}
                fill={theme.palette.warning.light}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
