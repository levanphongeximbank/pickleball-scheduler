import { Box, Paper, Stack, Typography } from "@mui/material";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
  TOURNAMENT_TYPE,
} from "./tournamentExperienceTokens.js";

export default function CenterRightRailCard({ title, children, icon, priority = false }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${priority ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.divider}`,
        boxShadow: TOURNAMENT_ELEVATION.card,
        mb: 1.25,
        minWidth: 0,
        bgcolor: priority ? TOURNAMENT_COLOR.warningSurface : TOURNAMENT_COLOR.cardBg,
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ mb: 1, alignItems: "center" }}>
        {icon ? (
          <Box sx={{ color: priority ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.primary, display: "flex" }}>
            {icon}
          </Box>
        ) : null}
        <Typography
          sx={{
            fontSize: TOURNAMENT_TYPE.sectionTitle.size,
            fontWeight: TOURNAMENT_TYPE.sectionTitle.weight,
            color: TOURNAMENT_COLOR.text,
          }}
        >
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
}
