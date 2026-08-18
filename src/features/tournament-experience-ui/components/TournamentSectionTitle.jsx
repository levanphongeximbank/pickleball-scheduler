import { Stack, Typography } from "@mui/material";

import { TOURNAMENT_COLOR, TOURNAMENT_TYPE } from "../design/tournamentDesignTokens.js";

export default function TournamentSectionTitle({ icon, children, action }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        {icon ? (
          <span style={{ display: "flex", color: TOURNAMENT_COLOR.primary }}>{icon}</span>
        ) : null}
        <Typography
          sx={{
            fontSize: TOURNAMENT_TYPE.sectionTitle.size,
            fontWeight: TOURNAMENT_TYPE.sectionTitle.weight,
            color: TOURNAMENT_COLOR.text,
          }}
        >
          {children}
        </Typography>
      </Stack>
      {action}
    </Stack>
  );
}
