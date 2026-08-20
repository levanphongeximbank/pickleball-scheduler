import { Paper } from "@mui/material";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
} from "./tournamentExperienceTokens.js";

export default function ExperienceOperatorCard({ children, sx }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        boxShadow: TOURNAMENT_ELEVATION.card,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
