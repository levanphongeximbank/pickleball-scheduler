import { Box, Paper, Stack, Typography } from "@mui/material";

export default function DailyStatsBar({
  totalPlayers = 0,
  matchCount = 0,
  courtsInUse = 0,
  estimatedMinutes = 0,
}) {
  const items = [
    { label: "Tổng người chơi", value: totalPlayers },
    { label: "Số trận đã tạo", value: matchCount },
    { label: "Số sân đang dùng", value: courtsInUse },
    {
      label: "Thời gian dự kiến",
      value: estimatedMinutes > 0 ? `${estimatedMinutes} phút` : "—",
    },
  ];

  return (
    <Paper variant="outlined" className="daily-fair-stats-bar" sx={{ p: 1.25, mb: 1.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        useFlexGap
        flexWrap="wrap"
      >
        {items.map((item) => (
          <Box key={item.label} sx={{ flex: 1, minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="subtitle1" fontWeight="bold" color="primary.main">
              {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
