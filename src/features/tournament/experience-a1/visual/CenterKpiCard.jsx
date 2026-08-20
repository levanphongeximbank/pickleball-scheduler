import { Box, Paper, Stack, Typography } from "@mui/material";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
  TOURNAMENT_TYPE,
} from "./tournamentExperienceTokens.js";

function toneColor(tone) {
  if (tone === "success") return TOURNAMENT_COLOR.success;
  if (tone === "warning") return TOURNAMENT_COLOR.warning;
  if (tone === "danger" || tone === "live") return TOURNAMENT_COLOR.danger;
  if (tone === "purple") return TOURNAMENT_COLOR.purple;
  return TOURNAMENT_COLOR.primary;
}

export default function CenterKpiCard({ label, value, hint, tone = "info", icon }) {
  const accent = toneColor(tone);

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        boxShadow: TOURNAMENT_ELEVATION.card,
        minWidth: 0,
        bgcolor: TOURNAMENT_COLOR.cardBg,
        height: "100%",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {icon ? (
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              bgcolor: `${accent}18`,
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              "& svg": { fontSize: 16 },
            }}
          >
            {icon}
          </Box>
        ) : null}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: TOURNAMENT_TYPE.kpiLabel.size,
              fontWeight: TOURNAMENT_TYPE.kpiLabel.weight,
              color: TOURNAMENT_COLOR.textMuted,
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: TOURNAMENT_TYPE.kpiValue.size,
              fontWeight: TOURNAMENT_TYPE.kpiValue.weight,
              lineHeight: TOURNAMENT_TYPE.kpiValue.lineHeight,
              color: TOURNAMENT_COLOR.text,
            }}
          >
            {value}
          </Typography>
          {hint ? (
            <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{hint}</Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
}
