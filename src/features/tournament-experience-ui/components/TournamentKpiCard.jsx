import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { Box, Paper, Stack, Typography } from "@mui/material";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
  TOURNAMENT_TYPE,
} from "../design/tournamentDesignTokens.js";

function toneColor(tone) {
  if (tone === "success") return TOURNAMENT_COLOR.success;
  if (tone === "warning") return TOURNAMENT_COLOR.warning;
  if (tone === "danger" || tone === "live") return TOURNAMENT_COLOR.danger;
  if (tone === "purple") return TOURNAMENT_COLOR.purple;
  return TOURNAMENT_COLOR.primary;
}

export default function TournamentKpiCard({
  label,
  value,
  hint,
  tone = "info",
  trend,
  icon,
}) {
  const accent = toneColor(tone);
  const trendUp = typeof trend === "string" && trend.startsWith("+");
  const trendDown = typeof trend === "string" && trend.startsWith("-");

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
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {trend ? (
              <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
                {trendUp ? <TrendingUpIcon sx={{ fontSize: 12, color: TOURNAMENT_COLOR.success }} /> : null}
                {trendDown ? <TrendingDownIcon sx={{ fontSize: 12, color: TOURNAMENT_COLOR.danger }} /> : null}
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: trendDown ? TOURNAMENT_COLOR.danger : TOURNAMENT_COLOR.success,
                  }}
                >
                  {trend}
                </Typography>
              </Stack>
            ) : null}
            {hint ? (
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{hint}</Typography>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
