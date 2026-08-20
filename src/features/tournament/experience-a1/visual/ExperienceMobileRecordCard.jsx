import { Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "./tournamentExperienceTokens.js";

export default function ExperienceMobileRecordCard({ title, meta, status, action, to, selected, onClick }) {
  return (
    <Paper
      elevation={0}
      component={to ? RouterLink : "div"}
      to={to}
      onClick={onClick}
      sx={{
        p: 1.25,
        mb: 1,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        cursor: onClick || to ? "pointer" : "default",
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${selected ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
        bgcolor: selected ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 0.4 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{title}</Typography>
        {status}
      </Stack>
      {meta}
      {action}
    </Paper>
  );
}
