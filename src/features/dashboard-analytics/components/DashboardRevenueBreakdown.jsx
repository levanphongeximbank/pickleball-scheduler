import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";

import { formatCurrency } from "../services/dashboardService.js";
import {
  dashboardCardContentSx,
  dashboardCardSx,
  dashboardSectionTitleSx,
} from "../constants/dashboardLayout.js";

function buildSlices(summary) {
  const total = summary?.revenue?.total || 0;
  if (!total) return [];

  const items = [
    { key: "booking", label: "Đặt sân", value: summary.revenue.booking || 0, color: "#10B981" },
    { key: "training", label: "Đào tạo", value: summary.revenue.membership || 0, color: "#3B82F6" },
    { key: "tournament", label: "Giải đấu", value: summary.revenue.tournament || 0, color: "#8B5CF6" },
    { key: "other", label: "Dịch vụ khác", value: summary.revenue.other || 0, color: "#F59E0B" },
  ].filter((item) => item.value > 0);

  let cursor = 0;
  return items.map((item) => {
    const percent = Math.round((item.value / total) * 1000) / 10;
    const start = cursor;
    cursor += percent;
    return { ...item, percent, start, end: cursor };
  });
}

function DonutChart({ slices }) {
  if (!slices.length) return null;

  const gradient = slices
    .map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
    .join(", ");

  return (
    <Box
      sx={{
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: `conic-gradient(${gradient})`,
        position: "relative",
        mx: "auto",
        mb: 1.75,
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 18,
          borderRadius: "50%",
          bgcolor: "background.paper",
        },
      }}
    />
  );
}

export default function DashboardRevenueBreakdown({ summary }) {
  const slices = buildSlices(summary);
  const total = summary?.revenue?.total || 0;

  return (
    <Card variant="outlined" sx={dashboardCardSx}>
      <CardContent sx={dashboardCardContentSx}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.75 }}>
          <AssessmentIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography sx={dashboardSectionTitleSx}>Doanh thu theo dịch vụ</Typography>
        </Stack>

        {!slices.length ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
            Chưa có dữ liệu doanh thu trong kỳ đã chọn.
          </Typography>
        ) : (
          <>
            <DonutChart slices={slices} />
            <Stack spacing={1}>
              {slices.map((slice) => (
                <Stack key={slice.key} direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: slice.color, flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }} noWrap>
                      {slice.label}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ fontSize: 12, flexShrink: 0 }}>
                    {slice.percent}%
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Box sx={{ pt: 1.25, mt: 1.25, borderTop: "1px solid", borderColor: "divider", textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11 }}>
                Tổng doanh thu
              </Typography>
              <Typography fontWeight={700} sx={{ fontSize: 14 }}>
                {formatCurrency(total)}
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
