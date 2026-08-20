import { Box } from "@mui/material";

import { TOURNAMENT_LAYOUT } from "../../../../components/tournament/tournamentLayout.js";
import { horizontalScrollSx } from "../../../../components/tournament/mobileUi.js";

/**
 * Tournament workspace inside MainLayout — prototype IA, production shell.
 */
export default function TournamentExperienceWorkspace({ children, rail, contextBar }) {
  return (
    <Box sx={{ width: "100%", minWidth: 0, overflowX: "hidden" }}>
      {contextBar ? (
        <Box sx={{ mb: TOURNAMENT_LAYOUT.sectionGap, minWidth: 0, ...horizontalScrollSx }}>
          {contextBar}
        </Box>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "1fr",
            lg: "minmax(0, 1fr) minmax(240px, 300px)",
          },
          gap: { xs: 1.5, md: 2, lg: 2.5 },
          alignItems: "start",
          width: "100%",
          minWidth: 0,
        }}
      >
        <Box sx={{ minWidth: 0, overflowX: "hidden" }}>{children}</Box>
        {rail ? <Box sx={{ minWidth: 0 }}>{rail}</Box> : null}
      </Box>
    </Box>
  );
}
