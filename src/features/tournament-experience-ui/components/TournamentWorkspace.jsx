import { Box } from "@mui/material";

import { TOURNAMENT_SPACE } from "../design/tournamentDesignTokens.js";

export default function TournamentWorkspace({ children, rail }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          lg: `minmax(0, 1fr) ${TOURNAMENT_SPACE.railWidth}px`,
        },
        gap: { xs: 1.5, lg: 2 },
        alignItems: "start",
        width: "100%",
      }}
    >
      <Box sx={{ minWidth: 0 }}>{children}</Box>
      {rail ? <Box sx={{ minWidth: 0 }}>{rail}</Box> : null}
    </Box>
  );
}
