import { Avatar, Box, Grid, Paper, Stack, Typography } from "@mui/material";

function StatCard({ label, value, color, icon }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: "100%",
        borderRadius: 2,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        bgcolor: "rgba(255, 255, 255, 0.9)",
        transition: "transform 0.2s ease",
        "&:hover": { transform: "translateY(-2px)" },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        {icon && (
          <Avatar sx={{ width: 40, height: 40, bgcolor: `${color}18`, color }}>
            {icon}
          </Avatar>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={900}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function CourtStats({ stats }) {
  const items = [
    { key: "total", label: "Tổng sân", value: stats.total, color: "#0f766e" },
    { key: "empty", label: "Sân trống", value: stats.empty, color: "#16a34a" },
    { key: "playing", label: "Đang thi đấu", value: stats.playing, color: "#4f46e5" },
    { key: "maintenance", label: "Bảo trì", value: stats.maintenance, color: "#ea580c" },
    { key: "waiting", label: "Người đang chờ", value: stats.waiting, color: "#ca8a04" },
    { key: "matches", label: "Trận đang chạy", value: stats.activeMatches, color: "#2563eb" },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {items.map((item) => (
        <Grid key={item.key} size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard {...item} />
        </Grid>
      ))}
    </Grid>
  );
}
