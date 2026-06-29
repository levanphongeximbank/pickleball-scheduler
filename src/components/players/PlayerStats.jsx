import { Avatar, Box, Grid, Paper, Stack, Typography } from "@mui/material";

function StatCard({ label, value, icon, color, hint }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: "100%",
        borderRadius: 2,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        bgcolor: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(8px)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          sx={{
            width: 42,
            height: 42,
            bgcolor: `${color}18`,
            color,
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={900} lineHeight={1.2}>
            {value}
          </Typography>
          {hint && (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function PlayerStats({ stats }) {
  const items = [
    {
      label: "Tổng người chơi",
      value: stats.total,
      color: "#0f766e",
      key: "total",
    },
    {
      label: "Nam",
      value: stats.male,
      color: "#2563eb",
      key: "male",
    },
    {
      label: "Nữ",
      value: stats.female,
      color: "#db2777",
      key: "female",
    },
    {
      label: "Level trung bình",
      value: stats.averageLevel.toFixed(1),
      color: "#ca8a04",
      key: "avg",
    },
    {
      label: "Check-in hôm nay",
      value: stats.checkedInHasData ? stats.checkedInToday : "0",
      hint: stats.checkedInHasData ? undefined : "Chưa có dữ liệu",
      color: "#7c3aed",
      key: "checkin",
    },
  ];

  if (stats.hasLiveData) {
    items.push({
      label: "Đang thi đấu / Chờ",
      value: `${stats.playingNow} / ${stats.waitingNow}`,
      color: "#4f46e5",
      key: "live",
    });
  }

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {items.map((item) => (
        <Grid key={item.key} size={{ xs: 6, sm: 4, md: items.length > 5 ? 2 : 3, lg: 2 }}>
          <StatCard {...item} />
        </Grid>
      ))}
    </Grid>
  );
}
