import { Paper, Stack, Typography } from "@mui/material";

import ExperienceStatusChip from "./ExperienceStatusChip.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "./tournamentExperienceTokens.js";

export default function ExperienceFormationPairCard({ pair }) {
  const warning = pair?.status === "Warning";
  const names = pair?.b ? `${pair.a} + ${pair.b}` : pair?.a || "—";
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${warning ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.divider}`,
        borderLeft: `3px solid ${warning ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.primary}`,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{pair?.id}</Typography>
        <ExperienceStatusChip tone={warning ? "warning" : "success"} label={warning ? "Cảnh báo" : "Hợp lệ"} />
      </Stack>
      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{names}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {pair?.mode} • Hạt giống {pair?.seed ?? "—"} • {pair?.source || "—"}
      </Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        Rating {pair?.ratingA ?? "—"} + {pair?.ratingB ?? "—"} = {pair?.combined ?? "—"}
      </Typography>
    </Paper>
  );
}
