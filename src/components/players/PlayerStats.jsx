import GroupsIcon from "@mui/icons-material/Groups";
import MaleIcon from "@mui/icons-material/Male";
import FemaleIcon from "@mui/icons-material/Female";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { Box, Grid, Paper, Stack, Typography } from "@mui/material";

import { SHELL } from "../../theme/designTokens.js";
import { TOURNAMENT_LAYOUT } from "../tournament/tournamentLayout.js";

function StatCard({ label, value, icon: Icon, color, hint }) {
  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        p: 2,
        height: "100%",
        borderRadius: TOURNAMENT_LAYOUT.cardRadius,
        borderColor: SHELL.border,
        bgcolor: SHELL.cardBg,
        boxShadow: SHELL.cardShadow,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            flexShrink: 0,
            bgcolor: `${color}14`,
            color,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            {value}
          </Typography>
          {hint ? (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          ) : null}
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
      color: SHELL.primaryGreen,
      icon: GroupsIcon,
      key: "total",
    },
    {
      label: "Nam",
      value: stats.male,
      color: "#2563eb",
      icon: MaleIcon,
      key: "male",
    },
    {
      label: "Nữ",
      value: stats.female,
      color: "#db2777",
      icon: FemaleIcon,
      key: "female",
    },
    {
      label: "Level trung bình",
      value: stats.averageLevel.toFixed(1),
      color: "#ca8a04",
      icon: TrendingUpIcon,
      key: "avg",
    },
    {
      label: "Check-in hôm nay",
      value: stats.checkedInHasData ? stats.checkedInToday : "0",
      hint: stats.checkedInHasData ? undefined : "Chưa có dữ liệu",
      color: "#7c3aed",
      icon: HowToRegIcon,
      key: "checkin",
    },
  ];

  if (stats.hasLiveData) {
    items.push({
      label: "Đang thi đấu / Chờ",
      value: `${stats.playingNow} / ${stats.waitingNow}`,
      color: "#4f46e5",
      icon: SportsTennisIcon,
      key: "live",
    });
  }

  return (
    <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing} sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
      {items.map((item) => (
        <Grid key={item.key} size={{ xs: 6, sm: 4, md: items.length > 5 ? 2 : 3, lg: 2 }}>
          <StatCard {...item} />
        </Grid>
      ))}
    </Grid>
  );
}
