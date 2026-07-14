import { useMemo } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";

import { buildIndividualAllGroupStandings } from "../../../features/individual-tournament/adapters/individualStandingsAdapter.js";
import BracketGroupStandingsPanel from "./BracketGroupStandingsPanel.jsx";
import BracketResultsTable from "./BracketResultsTable.jsx";

export default function BracketResultsView({ event, courts = [], viewModel }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));

  const groupStandings = useMemo(
    () => (event?.groups?.length ? buildIndividualAllGroupStandings(event) : []),
    [event]
  );

  const hasGroups = groupStandings.length > 0;

  return (
    <Box className="tournament-bracket-results-view">
      {hasGroups ? (
        <BracketGroupStandingsPanel
          standings={groupStandings}
          courts={courts}
          event={event}
        />
      ) : null}
      <BracketResultsTable viewModel={viewModel} desktop={desktop} />
    </Box>
  );
}
